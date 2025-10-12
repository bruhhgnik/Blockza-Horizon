use blockrooms::models::{
    Action, ActionResult, ActionType, AlertLevel, AttackAction, CollectShardAction, DoorPositions,
    EnterDoorAction, Entity, EntityImpl, EntityState, EntityTrait, EntityType, ExitDoorAction,
    GameConfig, GameConfigTrait, GameResult, GameSession, GameSessionTrait, MoveAction,
    NumberedShard, Player, PlayerImpl, PlayerStats, PlayerStatsTrait, PlayerTrait, Position,
    PositionImpl, PositionTrait, Room, RoomImpl, RoomTrait, ShardLocation,
};
use dojo::event::EventStorage;
use dojo::model::ModelStorage;
use dojo::world::WorldStorage;
use starknet::{ContractAddress, get_block_number, get_block_timestamp, get_caller_address};

#[starknet::interface]
pub trait IBlockRooms<T> {
    fn initialize_player(ref self: T);
    fn start_game(ref self: T);
    fn respawn_player(ref self: T);

    fn move_player(ref self: T, x_delta: u32, y_delta: u32);
    fn attack_entity(ref self: T, entity_id: felt252);
    fn collect_shard(ref self: T, shard_id: felt252, room_id: u32);
    fn exit_door(ref self: T, door_id: u32);
    fn enter_door(ref self: T, door_id: u32);

    fn get_shards_in_room(self: @T, room_id: u32) -> Array<felt252>;
    fn get_player_state(self: @T) -> Player;
    fn get_room_state(self: @T, room_id: u32) -> Room;
    fn get_entities_in_room(self: @T, room_id: u32) -> Array<Entity>;
    fn get_nearby_doors(self: @T) -> Array<u32>;
    fn get_game_status(self: @T) -> GameResult;
    fn end_game(ref self: T);
}

#[dojo::contract]
pub mod actions {
    use super::*;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct GameStarted {
        #[key]
        pub player_id: ContractAddress,
        pub session_id: felt252,
        pub start_time: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoomCleared {
        #[key]
        pub player_id: ContractAddress,
        pub room_id: u32,
        pub entities_defeated: u32,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct PlayerDeath {
        #[key]
        pub player_id: ContractAddress,
        pub room_id: u32,
        pub cause: felt252,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct GameCompleted {
        #[key]
        pub player_id: ContractAddress,
        pub session_id: felt252,
        pub rooms_cleared: u32,
        pub result: GameResult,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct VictoryAchieved {
        #[key]
        pub player_id: ContractAddress,
        pub session_id: felt252,
        pub completion_time: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct NumberedShardCollected {
        #[key]
        pub player_id: ContractAddress,
        pub shard_type: NumberedShard,
        pub room_id: u32,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoomEntered {
        #[key]
        pub player_id: ContractAddress,
        pub room_id: u32,
        pub door_id: u32,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct RoomExited {
        #[key]
        pub player_id: ContractAddress,
        pub room_id: u32,
        pub door_id: u32,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct PlayerMoved {
        #[key]
        pub player_id: ContractAddress,
        pub x: u32,
        pub y: u32,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct EntityAttacked {
        #[key]
        pub player_id: ContractAddress,
        pub entity_id: felt252,
        pub damage_dealt: u32,
        pub self_damage_taken: u32,
        pub entity_defeated: bool,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct ShardCollected {
        #[key]
        pub player_id: ContractAddress,
        pub shard_id: felt252,
        pub room_id: u32,
    }

    pub mod Errors {
        pub const GAME_NOT_ACTIVE: felt252 = 'game_not_active';
        pub const INVALID_MOVEMENT: felt252 = 'invalid_movement';
        pub const ENTITY_NOT_FOUND: felt252 = 'entity_not_found';
        pub const ENTITY_NOT_IN_ROOM: felt252 = 'entity_not_in_room';
        pub const DOOR_NOT_ACCESSIBLE: felt252 = 'door_not_accessible';
        pub const DOOR_LOCKED: felt252 = 'door_locked';
        pub const PLAYER_DEAD: felt252 = 'player_dead';
        pub const SHARD_NOT_FOUND: felt252 = 'shard_not_found';
        pub const NOT_IN_ROOM: felt252 = 'not_in_room';
        pub const NOT_IN_TRANSITION: felt252 = 'not_in_transition';
        pub const INVALID_DOOR: felt252 = 'invalid_door';
        pub const WRONG_ROOM: felt252 = 'wrong_room';
        pub const OUT_OF_BOUNDS: felt252 = 'out_of_bounds';
    }

    #[abi(embed_v0)]
    impl BlockRoomsImpl of IBlockRooms<ContractState> {
        fn initialize_player(ref self: ContractState) {
            let mut world = self.world_default();
            let player_id = get_caller_address();

            let existing_stats: PlayerStats = world.read_model(player_id);
            if existing_stats.games_played > 0 {
                return;
            }

            let player_stats = PlayerStatsTrait::new(player_id);
            world.write_model(@player_stats);

            let config_id = 'default';
            let existing_config: GameConfig = world.read_model(config_id);
            if existing_config.grid_size == 0 {
                let config = GameConfigTrait::default_config();
                world.write_model(@config);
            }
        }

        fn start_game(ref self: ContractState) {
            let mut world = self.world_default();
            let player_id = get_caller_address();

            let existing_player: Player = world.read_model(player_id);
            if existing_player.game_active {
                return;
            }

            let config: GameConfig = world.read_model('default');
            let session_id = self.generate_session_id(player_id);

            let player = PlayerTrait::new(player_id, session_id, config);
            world.write_model(@player);

            let game_session = GameSessionTrait::new(session_id, player_id, get_block_timestamp());
            world.write_model(@game_session);

            let mut player_stats: PlayerStats = world.read_model(player_id);
            player_stats.start_game();
            world.write_model(@player_stats);

            self.cleanup_previous_session_data(ref world);

            world
                .emit_event(
                    @GameStarted { player_id, session_id, start_time: get_block_timestamp() },
                );
        }

        fn move_player(ref self: ContractState, x_delta: u32, y_delta: u32) {
            let mut world = self.world_default();
            let player_id = get_caller_address();

            let mut player: Player = world.read_model(player_id);
            assert(player.game_active && player.is_alive, Errors::GAME_NOT_ACTIVE);

            assert(x_delta <= 2 && y_delta <= 2, Errors::INVALID_MOVEMENT);

            let actual_x_delta = match x_delta {
                0 => -1,
                1 => 0,
                2 => 1,
                _ => 0,
            };

            let actual_y_delta = match y_delta {
                0 => -1,
                1 => 0,
                2 => 1,
                _ => 0,
            };

            let old_position = player.position;
            let new_position = old_position.move_by_delta(actual_x_delta, actual_y_delta);

            // Check bounds within current room
            let config: GameConfig = world.read_model('default');
            assert(new_position.is_valid_on_grid(config.grid_size), Errors::OUT_OF_BOUNDS);

            player.change_position(new_position);
            world.write_model(@player);

            let mut player_stats: PlayerStats = world.read_model(player_id);
            player_stats.record_action_taken();
            world.write_model(@player_stats);

            world.emit_event(@PlayerMoved { player_id, x: new_position.x, y: new_position.y });
        }

        fn attack_entity(ref self: ContractState, entity_id: felt252) {
            let mut world = self.world_default();
            let player_id = get_caller_address();

            let mut player: Player = world.read_model(player_id);
            assert(player.game_active && player.is_alive, Errors::GAME_NOT_ACTIVE);
            assert(player.can_attack_or_collect(), Errors::NOT_IN_ROOM);

            let mut entity: Entity = world.read_model(entity_id);
            assert(entity.is_alive, Errors::ENTITY_NOT_FOUND);
            assert(entity.is_in_same_room(player.current_room), Errors::ENTITY_NOT_IN_ROOM);

            let config: GameConfig = world.read_model('default');
            let damage_to_entity = config.get_base_damage();

            // Player takes self-damage based on entity type
            let self_damage = config.get_self_damage_for_entity_type(entity.entity_type);
            let _ = player.take_damage(self_damage);

            let entity_defeated = !entity.take_damage(damage_to_entity);
            world.write_model(@entity);

            if entity_defeated {
                let dropped_shard = entity.get_dropped_shard();
                if dropped_shard.is_some() {
                    let shard_location = ShardLocation {
                        shard_id: entity_id,
                        room_id: entity.room_id,
                        numbered_shard: dropped_shard,
                        collected: false,
                    };
                    world.write_model(@shard_location);
                }

                // Update room state
                let mut room: Room = world.read_model(entity.room_id);
                room.defeat_entity();
                world.write_model(@room);

                if room.is_cleared() {
                    player.clear_room();
                    world
                        .emit_event(
                            @RoomCleared {
                                player_id,
                                room_id: room.room_id,
                                entities_defeated: room.entity_count - room.active_entities,
                            },
                        );
                }

                // Update stats
                let mut game_session: GameSession = world.read_model(player.current_session_id);
                game_session.defeat_entity();
                game_session.deal_damage(damage_to_entity);
                game_session.take_damage(self_damage);
                world.write_model(@game_session);

                let mut player_stats: PlayerStats = world.read_model(player_id);
                player_stats.record_entity_defeat();
                player_stats.record_damage_dealt(damage_to_entity);
                player_stats.record_damage_taken(self_damage);
                player_stats.record_action_taken();
                world.write_model(@player_stats);
            }

            if !player.is_alive {
                world
                    .emit_event(
                        @PlayerDeath {
                            player_id, room_id: player.current_room, cause: 'self_damage',
                        },
                    );
            }

            world.write_model(@player);

            world
                .emit_event(
                    @EntityAttacked {
                        player_id,
                        entity_id,
                        damage_dealt: damage_to_entity,
                        self_damage_taken: self_damage,
                        entity_defeated,
                    },
                );
        }

        fn collect_shard(ref self: ContractState, shard_id: felt252, room_id: u32) {
            let mut world = self.world_default();
            let player_id = get_caller_address();

            let mut player: Player = world.read_model(player_id);
            assert(player.game_active && player.is_alive, Errors::GAME_NOT_ACTIVE);
            assert(player.can_attack_or_collect(), Errors::NOT_IN_ROOM);
            assert(player.current_room == room_id, Errors::WRONG_ROOM);

            // Direct lookup using the passed shard_id
            let mut shard_location: ShardLocation = world.read_model(shard_id);
            assert(!shard_location.collected, Errors::SHARD_NOT_FOUND);
            assert(shard_location.room_id == player.current_room, Errors::SHARD_NOT_FOUND);

            shard_location.collected = true;
            world.write_model(@shard_location);

            let mut game_won = false;
            match shard_location.numbered_shard {
                Option::Some(numbered_shard) => {
                    game_won = player.collect_numbered_shard(numbered_shard);

                    let mut game_session: GameSession = world.read_model(player.current_session_id);
                    game_session.collect_numbered_shard();
                    world.write_model(@game_session);

                    let mut player_stats: PlayerStats = world.read_model(player_id);
                    player_stats.add_numbered_shard();
                    world.write_model(@player_stats);

                    world
                        .emit_event(
                            @NumberedShardCollected {
                                player_id, shard_type: numbered_shard, room_id,
                            },
                        );
                },
                Option::None => {
                    player.collect_shard();

                    let mut game_session: GameSession = world.read_model(player.current_session_id);
                    game_session.collect_shard();
                    world.write_model(@game_session);

                    let mut player_stats: PlayerStats = world.read_model(player_id);
                    player_stats.add_shards_collected(1);
                    world.write_model(@player_stats);
                },
            }

            let mut player_stats: PlayerStats = world.read_model(player_id);
            player_stats.record_action_taken();
            world.write_model(@player_stats);

            if game_won {
                self.handle_victory(ref world, ref player);
            }

            world.write_model(@player);

            world.emit_event(@ShardCollected { player_id, shard_id, room_id });
        }

        fn exit_door(ref self: ContractState, door_id: u32) {
            let mut world = self.world_default();
            let player_id = get_caller_address();

            let mut player: Player = world.read_model(player_id);
            assert(player.game_active && player.is_alive, Errors::GAME_NOT_ACTIVE);

            let door_position = DoorPositions::get_door_position_in_room(door_id);
            let door_room = DoorPositions::get_door_room(door_id);

            assert(door_room > 0, Errors::INVALID_DOOR);
            assert(player.can_exit_door(door_id, door_position), Errors::DOOR_NOT_ACCESSIBLE);

            // Check if room has living entities (door should be locked)
            let room: Room = world.read_model(player.current_room);
            assert(!room.doors_are_locked(), Errors::DOOR_LOCKED);

            // Move player to transition space
            player.exit_to_transition();
            world.write_model(@player);

            let mut player_stats: PlayerStats = world.read_model(player_id);
            player_stats.record_action_taken();
            world.write_model(@player_stats);

            world.emit_event(@RoomExited { player_id, room_id: door_room, door_id });
        }

        fn enter_door(ref self: ContractState, door_id: u32) {
            let mut world = self.world_default();
            let player_id = get_caller_address();

            let mut player: Player = world.read_model(player_id);
            assert(player.game_active && player.is_alive, Errors::GAME_NOT_ACTIVE);
            assert(player.is_in_transition(), Errors::NOT_IN_TRANSITION);
            assert(player.can_enter_door(door_id), Errors::INVALID_DOOR);

            let target_room = DoorPositions::get_door_room(door_id);
            assert(target_room > 0, Errors::INVALID_DOOR);

            // Initialize room if needed (lazy loading)
            self.initialize_room_if_needed(ref world, target_room);

            // Move player to room
            player.enter_room(target_room);
            world.write_model(@player);

            let mut player_stats: PlayerStats = world.read_model(player_id);
            player_stats.record_door_opened();
            player_stats.record_action_taken();
            world.write_model(@player_stats);

            let mut game_session: GameSession = world.read_model(player.current_session_id);
            game_session.open_door();
            world.write_model(@game_session);

            world.emit_event(@RoomEntered { player_id, room_id: target_room, door_id });
        }

        fn respawn_player(ref self: ContractState) {
            let mut world = self.world_default();
            let player_id = get_caller_address();

            let mut player: Player = world.read_model(player_id);
            let mut game_session: GameSession = world.read_model(player.current_session_id);

            assert(player.game_active && !player.is_alive, Errors::GAME_NOT_ACTIVE);

            player.respawn();
            game_session.record_death();

            world.write_model(@player);
            world.write_model(@game_session);
        }

        fn end_game(ref self: ContractState) {
            let mut world = self.world_default();
            let player_id = get_caller_address();

            let mut player: Player = world.read_model(player_id);
            let mut game_session: GameSession = world.read_model(player.current_session_id);
            let mut player_stats: PlayerStats = world.read_model(player_id);

            assert(player.game_active, Errors::GAME_NOT_ACTIVE);

            let end_time = get_block_timestamp();
            let playtime = game_session.get_duration();

            game_session.end_session(end_time);
            player.end_game();

            let is_victory = player.has_victory_condition();
            if is_victory {
                player_stats.complete_game(playtime, game_session.rooms_cleared);
                game_session.complete_with_victory(end_time);
            }

            player_stats.add_playtime(playtime);

            world.write_model(@player);
            world.write_model(@game_session);
            world.write_model(@player_stats);

            let result = if is_victory {
                GameResult::Victory
            } else {
                GameResult::Defeat
            };

            world
                .emit_event(
                    @GameCompleted {
                        player_id,
                        session_id: game_session.session_id,
                        rooms_cleared: game_session.rooms_cleared,
                        result,
                    },
                );
        }

        fn get_shards_in_room(self: @ContractState, room_id: u32) -> Array<felt252> {
            let world = self.world_default();
            let mut available_shards = ArrayTrait::new();

            // Get all entities in the room to check for potential shards
            let config: GameConfig = world.read_model('default');
            let entity_count = config.get_entities_per_room();

            let mut i = 0;
            loop {
                if i >= entity_count {
                    break;
                }

                let entity_id = self.generate_entity_id(room_id, i);
                let shard_location: ShardLocation = world.read_model(entity_id);

                // Check if this entity dropped a shard and it's not collected
                if shard_location.room_id == room_id && !shard_location.collected {
                    available_shards.append(entity_id);
                }

                i += 1;
            };

            available_shards
        }

        fn get_player_state(self: @ContractState) -> Player {
            let world = self.world_default();
            let player_id = get_caller_address();
            world.read_model(player_id)
        }

        fn get_room_state(self: @ContractState, room_id: u32) -> Room {
            let world = self.world_default();
            world.read_model(room_id)
        }

        fn get_entities_in_room(self: @ContractState, room_id: u32) -> Array<Entity> {
            // Implementation would query entities by room_id
            ArrayTrait::new()
        }

        fn get_nearby_doors(self: @ContractState) -> Array<u32> {
            let world = self.world_default();
            let player_id = get_caller_address();
            let player: Player = world.read_model(player_id);
            let config: GameConfig = world.read_model('default');

            let mut nearby_doors = ArrayTrait::new();

            if player.is_in_transition() {
                // In transition space - can enter any room
                let mut door_id = 1;
                loop {
                    if door_id > 18 {
                        break;
                    }
                    nearby_doors.append(door_id);
                    door_id += 1;
                };
            } else {
                // In a room - check doors within range
                let mut door_id = 1;
                loop {
                    if door_id > 18 {
                        break;
                    }

                    let door_room = DoorPositions::get_door_room(door_id);
                    if door_room == player.current_room {
                        let door_position = DoorPositions::get_door_position_in_room(door_id);
                        if player
                            .position
                            .distance_to(door_position) <= config
                            .door_detection_range {
                            nearby_doors.append(door_id);
                        }
                    }

                    door_id += 1;
                };
            }

            nearby_doors
        }

        fn get_game_status(self: @ContractState) -> GameResult {
            let world = self.world_default();
            let player_id = get_caller_address();
            let player: Player = world.read_model(player_id);

            if !player.game_active {
                if player.has_victory_condition() {
                    return GameResult::Victory;
                }
                return GameResult::Defeat;
            }
            GameResult::InProgress
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> WorldStorage {
            self.world(@"blockrooms")
        }

        fn cleanup_previous_session_data(self: @ContractState, ref world: WorldStorage) {
            let config: GameConfig = world.read_model('default');
            let entity_count = config.get_entities_per_room();

            // Clean up all rooms (1-10)
            let mut room_id = 1;
            loop {
                if room_id > 10 {
                    break;
                }

                // Reset room state
                let mut room: Room = world.read_model(room_id);
                if room.initialized {
                    room.initialized = false;
                    room.cleared = false;
                    room.active_entities = 0;
                    room.entity_count = 0;
                    world.write_model(@room);
                }

                // Clean up entities and shards in this room
                let mut i = 0;
                loop {
                    if i >= entity_count {
                        break;
                    }

                    let entity_id = self.generate_entity_id(room_id, i);

                    // Kill entity if it exists
                    let mut entity: Entity = world.read_model(entity_id);
                    if entity.room_id > 0 {
                        entity.is_alive = false;
                        entity.health = 0;
                        world.write_model(@entity);
                    }

                    // Mark shard as collected if it exists
                    let mut shard_location: ShardLocation = world.read_model(entity_id);
                    if shard_location.room_id > 0 {
                        shard_location.collected = true;
                        world.write_model(@shard_location);
                    }

                    i += 1;
                };

                room_id += 1;
            };
        }

        fn initialize_room_if_needed(self: @ContractState, ref world: WorldStorage, room_id: u32) {
            let room: Room = world.read_model(room_id);
            if !room.initialized {
                self.initialize_room(ref world, room_id);
            }
        }

        fn initialize_room(self: @ContractState, ref world: WorldStorage, room_id: u32) {
            let config: GameConfig = world.read_model('default');
            let mut room = RoomTrait::new(room_id);
            room.initialize(config);
            world.write_model(@room);

            self.spawn_entities_in_room(ref world, room_id, config);
        }

        fn spawn_entities_in_room(
            self: @ContractState, ref world: WorldStorage, room_id: u32, config: GameConfig,
        ) {
            let entity_count = config.get_entities_per_room();

            let mut i = 0;
            loop {
                if i >= entity_count {
                    break;
                }

                let entity_id = self.generate_entity_id(room_id, i);
                let entity_type = self.determine_entity_type(i);

                // Randomly assign numbered shard drops
                let shard_drop = if self.should_drop_numbered_shard(config.shard_drop_rate) {
                    Option::Some(self.get_random_numbered_shard())
                } else {
                    Option::None
                };

                let entity = EntityImpl::new_with_shard_drop(
                    entity_id, entity_type, room_id, shard_drop,
                );
                world.write_model(@entity);

                let entity_state = EntityState {
                    entity_id, alert_level: AlertLevel::Idle, last_action_block: get_block_number(),
                };
                world.write_model(@entity_state);

                i += 1;
            };
        }

        fn handle_victory(self: @ContractState, ref world: WorldStorage, ref player: Player) {
            let mut game_session: GameSession = world.read_model(player.current_session_id);
            let end_time = get_block_timestamp();

            game_session.complete_with_victory(end_time);
            player.end_game();

            world.write_model(@game_session);
            world.write_model(@player);

            world
                .emit_event(
                    @VictoryAchieved {
                        player_id: player.player_id,
                        session_id: player.current_session_id,
                        completion_time: game_session.get_duration(),
                    },
                );
        }

        fn generate_session_id(self: @ContractState, player_id: ContractAddress) -> felt252 {
            let timestamp = get_block_timestamp();
            let block_number = get_block_number();
            let player_felt: felt252 = player_id.into();
            timestamp.into() + block_number.into() + player_felt
        }

        fn generate_entity_id(self: @ContractState, room_id: u32, index: u32) -> felt252 {
            let room_felt: felt252 = room_id.into();
            let index_felt: felt252 = index.into();
            'entity' + room_felt + index_felt
        }

        fn generate_shard_location_id(self: @ContractState, room_id: u32) -> felt252 {
            let room_felt: felt252 = room_id.into();
            'shard' + room_felt + get_block_timestamp().into()
        }

        fn determine_entity_type(self: @ContractState, index: u32) -> EntityType {
            match index % 2 {
                0 => EntityType::Male,
                1 => EntityType::Female,
                _ => EntityType::Male,
            }
        }

        fn get_random_numbered_shard(self: @ContractState) -> NumberedShard {
            let block_num = get_block_number();
            let timestamp = get_block_timestamp();
            let random_value = (block_num + timestamp) % 3;

            if random_value == 0 {
                NumberedShard::One
            } else if random_value == 1 {
                NumberedShard::Two
            } else {
                NumberedShard::Three
            }
        }

        fn should_drop_numbered_shard(self: @ContractState, drop_rate_percentage: u32) -> bool {
            let block_num = get_block_number();
            let random_value = block_num % 100;
            random_value < drop_rate_percentage.into()
        }
    }
}
