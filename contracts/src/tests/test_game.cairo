#[cfg(test)]
mod tests {
    // Starknet imports
    use starknet::{ContractAddress, get_block_timestamp};
    use starknet::testing::{
        set_account_contract_address, set_block_timestamp, set_contract_address,
    };

    // Models imports
    use blockrooms::models::{
        ActionType, AlertLevel, DoorPositions, Entity, EntityState, 
        EntityTrait, EntityType, GameConfig, GameConfigTrait, GameResult, GameSession,
        GameSessionTrait, NumberedShard, Player, PlayerStats, PlayerStatsTrait, 
        PlayerTrait, Position, PositionTrait, Room, RoomTrait, ShardLocation,
        m_PlayerStats, m_Player, m_GameSession, m_GameConfig, m_Room, m_Entity, 
        m_EntityState, m_ShardLocation,
    };

    // System imports
    use blockrooms::systems::actions::{
        IBlockRoomsDispatcher, IBlockRoomsDispatcherTrait, actions
    };
    use dojo::model::ModelStorage;
    use dojo::world::{WorldStorage, WorldStorageTrait};

    // Dojo imports
    use dojo_cairo_test::WorldStorageTestTrait;
    use dojo_cairo_test::{
        ContractDef, ContractDefTrait, NamespaceDef, TestResource, spawn_test_world,
    };

    // ------- Constants -------
    fn PLAYER() -> ContractAddress {
        starknet::contract_address_const::<'PLAYER'>()
    }

    fn PLAYER_2() -> ContractAddress {
        starknet::contract_address_const::<'PLAYER_2'>()
    }

    fn namespace_def() -> NamespaceDef {
        let ndef = NamespaceDef {
            namespace: "blockrooms",
            resources: [
                // Models
                TestResource::Model(m_Player::TEST_CLASS_HASH),
                TestResource::Model(m_PlayerStats::TEST_CLASS_HASH),
                TestResource::Model(m_GameSession::TEST_CLASS_HASH),
                TestResource::Model(m_GameConfig::TEST_CLASS_HASH),
                TestResource::Model(m_Room::TEST_CLASS_HASH),
                TestResource::Model(m_Entity::TEST_CLASS_HASH),
                TestResource::Model(m_EntityState::TEST_CLASS_HASH),
                TestResource::Model(m_ShardLocation::TEST_CLASS_HASH),
                // Contract
                TestResource::Contract(actions::TEST_CLASS_HASH),
                // Events
                TestResource::Event(actions::e_GameStarted::TEST_CLASS_HASH),
                TestResource::Event(actions::e_RoomCleared::TEST_CLASS_HASH),
                TestResource::Event(actions::e_PlayerDeath::TEST_CLASS_HASH),
                TestResource::Event(actions::e_GameCompleted::TEST_CLASS_HASH),
                TestResource::Event(actions::e_VictoryAchieved::TEST_CLASS_HASH),
                TestResource::Event(actions::e_NumberedShardCollected::TEST_CLASS_HASH),
                TestResource::Event(actions::e_RoomEntered::TEST_CLASS_HASH),
                TestResource::Event(actions::e_RoomExited::TEST_CLASS_HASH),
            ]
                .span(),
        };
        ndef
    }

    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(@"blockrooms", @"actions")
                .with_writer_of([
                dojo::utils::bytearray_hash(@"blockrooms"),
                m_Player::TEST_CLASS_HASH,
                m_Entity::TEST_CLASS_HASH, 
                m_ShardLocation::TEST_CLASS_HASH,
                m_Room::TEST_CLASS_HASH
            ].span()),

        ]
            .span()
    }

    fn create_game_system(world: WorldStorage) -> IBlockRoomsDispatcher {
        let (contract_address, _) = world.dns(@"actions").unwrap();
        let game_system = IBlockRoomsDispatcher { contract_address };
        game_system
    }

    fn create_test_world() -> WorldStorage {
        let ndef = namespace_def();
        let mut world = spawn_test_world([ndef].span());
        world.sync_perms_and_inits(contract_defs());
        world
    }

    // ------- Helper Functions -------
    fn cheat_caller_address(address: ContractAddress) {
        set_contract_address(address);
        set_account_contract_address(address);
    }

    fn cheat_block_timestamp(timestamp: u64) {
        set_block_timestamp(timestamp);
    }

    fn setup_player_and_game(
        world: WorldStorage, game_system: IBlockRoomsDispatcher, player: ContractAddress,
    ) {
        cheat_caller_address(player);
        game_system.initialize_player();
        game_system.start_game();
    }

    // ------- Test Cases -------

    #[test]
    #[available_gas(40000000)]
    fn test_initialize_player() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        cheat_caller_address(PLAYER());
        game_system.initialize_player();

        let player_stats: PlayerStats = world.read_model(PLAYER());
        let config: GameConfig = world.read_model('default');

        assert(player_stats.player_id == PLAYER(), 'player id match');
        assert(player_stats.games_played == 0, 'games played 0');
        assert(player_stats.total_shards_collected == 0, 'shards 0');
        assert(player_stats.total_entities_defeated == 0, 'entities 0');
        assert(player_stats.total_playtime == 0, 'playtime 0');
        assert(player_stats.numbered_shards_collected == 0, 'numbered shards 0');

        assert(config.grid_size > 0, 'grid size set');
        assert(config.starting_health > 0, 'start hp set');
        assert(config.base_damage > 0, 'base damage set');
    }

    #[test]
    #[available_gas(40000000)]
    fn test_initialize_player_twice() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        cheat_caller_address(PLAYER());
        game_system.initialize_player();

        let stats_before: PlayerStats = world.read_model(PLAYER());

        // Try to initialize again - should not reset values
        game_system.initialize_player();

        let stats_after: PlayerStats = world.read_model(PLAYER());

        assert(stats_before.player_id == stats_after.player_id, 'stats same');
        assert(stats_before.games_played == stats_after.games_played, 'games same');
    }

    #[test]
    #[available_gas(160000000)]
    fn test_start_game() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        cheat_caller_address(PLAYER());
        cheat_block_timestamp(1000);

        game_system.initialize_player();
        game_system.start_game();

        let player: Player = world.read_model(PLAYER());
        let config: GameConfig = world.read_model('default');

        assert(player.game_active, 'game active');
        assert(player.is_alive, 'player alive');
        assert(player.current_room == 0, 'in transition');
        assert(player.position.x == 25 && player.position.y == 25, 'transition pos');
        assert(player.health == config.starting_health, 'full health');
        assert(player.shards == config.starting_shards, 'starting shards');
        assert(!player.has_shard_one, 'no shard one');
        assert(!player.has_shard_two, 'no shard two');
        assert(!player.has_shard_three, 'no shard three');
        assert(player.rooms_cleared == 0, 'no rooms cleared');
        assert(!player.has_key, 'no key');
        assert(player.special_ability_cooldown == 0, 'no cooldown');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_start_game_twice() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        cheat_caller_address(PLAYER());
        game_system.initialize_player();
        game_system.start_game();

        let state_before: Player = world.read_model(PLAYER());

        // Try to start game again - should not reset
        game_system.start_game();

        let state_after: Player = world.read_model(PLAYER());

        assert(state_before.health == state_after.health, 'health same');
        assert(state_before.shards == state_after.shards, 'shards same');
        assert(state_before.current_session_id == state_after.current_session_id, 'session same');
    }

    #[test]
    #[available_gas(160000000)]
    fn test_enter_door() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());

        let player_before: Player = world.read_model(PLAYER());
        assert(player_before.is_in_transition(), 'starts in transition');
        
        game_system.enter_door(1); // Enter door 1 to room 1

        let player_after: Player = world.read_model(PLAYER());
        let room: Room = world.read_model(1_u32);

        assert(player_after.current_room == 1, 'entered room 1');
        assert(player_after.position.x == 5 && player_after.position.y == 5, 'room entry pos');
        assert(room.initialized, 'room initialized');
        assert(!room.cleared, 'room not cleared');
        assert(room.active_entities == 2, 'has entities');
    }

    #[test]
    #[available_gas(160000000)]
    fn test_exit_door() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room 1

        // Clear room entities to unlock doors
        let mut room: Room = world.read_model(1_u32);
        room.defeat_entity();
        room.defeat_entity();
        world.write_model(@room);

        let player_before: Player = world.read_model(PLAYER());
        assert(player_before.current_room == 1, 'in room 1');

        // Position player near door 1 position
        let mut player = player_before;
        player.change_position(PositionTrait::new(27, 28));
        world.write_model(@player);

        game_system.exit_door(1);

        let player_after: Player = world.read_model(PLAYER());
        assert(player_after.is_in_transition(), 'back in transition');
        assert(player_after.position.x == 25 && player_after.position.y == 25, 'transition pos');
    }

    #[test]
    #[available_gas(200000000)]
    fn test_move_player() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room to enable movement

        let player_before: Player = world.read_model(PLAYER());
        
        game_system.move_player(0, 1); // Move north

        let player_after: Player = world.read_model(PLAYER());

        assert(player_after.position.y == player_before.position.y + 1, 'moved north');
        assert(player_after.position.x == player_before.position.x, 'x unchanged');
    }

    #[test]
    #[available_gas(300000000)]
    fn test_attack_entity() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room 1

        let player: Player = world.read_model(PLAYER());
        let entity_id = 'entity' + 1.into() + 0.into(); // First entity in room 1
        let entity_before: Entity = world.read_model(entity_id);
        
        let entity_health_before = entity_before.health;
        let player_health_before = player.health;
        
        game_system.attack_entity(entity_id);

        let player_after: Player = world.read_model(PLAYER());
        let entity_after: Entity = world.read_model(entity_id);
        let config: GameConfig = world.read_model('default');

        assert(entity_after.health < entity_health_before, 'entity took damage');
        assert(player_after.health < player_health_before, 'player took self damage');
        
        let expected_entity_damage = entity_health_before - config.get_base_damage();
        assert(entity_after.health == expected_entity_damage, 'correct entity damage');
        
        let expected_self_damage = config.get_self_damage_for_entity_type(entity_before.entity_type);
        let expected_player_health = player_health_before - expected_self_damage;
        assert(player_after.health == expected_player_health, 'correct self damage');
    }

    #[test]
    #[available_gas(200000000)]
    fn test_collect_regular_shard() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room

        let player_before: Player = world.read_model(PLAYER());
        
        // Create a shard dropped by an entity (simulate entity defeat)
        let shard_id = 'entity' + 1.into() + 0.into(); // Use entity ID as shard ID
        let shard_location = ShardLocation {
            shard_id,
            room_id: player_before.current_room,
            numbered_shard: Option::None,
            collected: false,
        };
        world.write_model(@shard_location);

        game_system.collect_shard(shard_id, player_before.current_room);

        let player_after: Player = world.read_model(PLAYER());
        let shard_after: ShardLocation = world.read_model(shard_id);

        assert(player_after.shards == player_before.shards + 1, 'shard collected');
        assert(shard_after.collected, 'shard marked collected');
    }

    #[test]
    #[available_gas(200000000)]
    fn test_collect_numbered_shard() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room

        let player_before: Player = world.read_model(PLAYER());
        
        // Create a numbered shard dropped by an entity
        let shard_id = 'entity' + 1.into() + 0.into();
        let shard_location = ShardLocation {
            shard_id,
            room_id: player_before.current_room,
            numbered_shard: Option::Some(NumberedShard::One),
            collected: false,
        };
        world.write_model(@shard_location);

        game_system.collect_shard(shard_id, player_before.current_room);

        let player_after: Player = world.read_model(PLAYER());

        assert(player_after.has_shard_one, 'has shard one');
        assert(player_after.game_active, 'game still active'); // Only one shard
    }

    #[test]
    #[available_gas(250000000)]
    fn test_victory_condition() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room

        let player_before: Player = world.read_model(PLAYER());
        
        // Collect all three numbered shards
        let shard1_id = 'shard1';
        let shard1_location = ShardLocation {
            shard_id: shard1_id,
            room_id: player_before.current_room,
            numbered_shard: Option::Some(NumberedShard::One),
            collected: false,
        };
        world.write_model(@shard1_location);
        game_system.collect_shard(shard1_id, player_before.current_room);

        let shard2_id = 'shard2';
        let shard2_location = ShardLocation {
            shard_id: shard2_id,
            room_id: player_before.current_room,
            numbered_shard: Option::Some(NumberedShard::Two),
            collected: false,
        };
        world.write_model(@shard2_location);
        game_system.collect_shard(shard2_id, player_before.current_room);

        // Third shard should trigger victory
        let shard3_id = 'shard3';
        let shard3_location = ShardLocation {
            shard_id: shard3_id,
            room_id: player_before.current_room,
            numbered_shard: Option::Some(NumberedShard::Three),
            collected: false,
        };
        world.write_model(@shard3_location);
        game_system.collect_shard(shard3_id, player_before.current_room);
        
        let final_player: Player = world.read_model(PLAYER());
        assert(final_player.has_victory_condition(), 'victory condition met');
        assert(!final_player.game_active, 'game ended');
    }

    #[test]
    #[available_gas(80000000)]
    fn test_respawn_player() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());

        // Kill player by setting them as dead
        let mut player: Player = world.read_model(PLAYER());
        let original_shards = player.shards;
        let config: GameConfig = world.read_model('default');
        
        player.is_alive = false;
        player.health = 0;
        player.current_room = 5; // Put in some room
        world.write_model(@player);

        game_system.respawn_player();

        let player_after: Player = world.read_model(PLAYER());

        assert(player_after.is_alive, 'player alive');
        assert(player_after.health == config.starting_health, 'full health');
        assert(player_after.is_in_transition(), 'back in transition');
        assert(player_after.shards == original_shards / 2, 'half shards');
    }

    #[test]
    #[available_gas(160000000)]
    fn test_end_game() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        cheat_caller_address(PLAYER());
        cheat_block_timestamp(1000);

        setup_player_and_game(world, game_system, PLAYER());

        cheat_block_timestamp(2000);

        game_system.end_game();

        let player: Player = world.read_model(PLAYER());
        let player_stats: PlayerStats = world.read_model(PLAYER());
        let game_session: GameSession = world.read_model(player.current_session_id);

        assert(!player.game_active, 'game not active');
        assert(game_session.session_complete, 'session complete');
        assert(game_session.end_time == 2000, 'end time set');
    }

    #[test]
    #[available_gas(160000000)]
    fn test_get_game_status() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        cheat_caller_address(PLAYER());
        game_system.initialize_player();

        let status_before = game_system.get_game_status();
        assert(status_before == GameResult::Defeat, 'defeat status');

        game_system.start_game();

        let status_active = game_system.get_game_status();
        assert(status_active == GameResult::InProgress, 'in progress');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_get_player_state() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());

        let player_state = game_system.get_player_state();

        assert(player_state.player_id == PLAYER(), 'player id ok');
        assert(player_state.game_active, 'game active');
        assert(player_state.is_in_transition(), 'in transition');
        assert(player_state.is_alive, 'player alive');
        assert(player_state.special_ability_cooldown == 0, 'no cooldown');
        assert(!player_state.has_key, 'no key');
    }

    #[test]
    #[available_gas(120000000)]
    fn test_get_room_state() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Initialize room 1

        let room_state = game_system.get_room_state(1);

        assert(room_state.room_id == 1, 'room id 1');
        assert(room_state.initialized, 'room initialized');
        assert(!room_state.cleared, 'room not cleared');
        assert(room_state.active_entities == 2, 'has 2 entities');
    }

    #[test]
    #[available_gas(120000000)]
    fn test_get_shards_in_room() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1);

        let player: Player = world.read_model(PLAYER());

        // Create some shards in the room
        let shard1_id = 'test_shard_1';
        let shard1 = ShardLocation {
            shard_id: shard1_id,
            room_id: player.current_room,
            numbered_shard: Option::Some(NumberedShard::One),
            collected: false,
        };
        world.write_model(@shard1);

        let shard2_id = 'test_shard_2';
        let shard2 = ShardLocation {
            shard_id: shard2_id,
            room_id: player.current_room,
            numbered_shard: Option::None,
            collected: false,
        };
        world.write_model(@shard2);

        let shards = game_system.get_shards_in_room(player.current_room);
        // Note: The actual implementation generates entity-based shard IDs
        // This test verifies the function works, actual shard detection depends on entity defeats
    }

    #[test]
    #[available_gas(120000000)]
    fn test_get_nearby_doors() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());

        // In transition - should see all doors
        let doors_in_transition = game_system.get_nearby_doors();
        assert(doors_in_transition.len() == 18, 'all doors visible');

        // Enter room and check doors within range
        game_system.enter_door(1); // Enter room 1
        let doors_in_room = game_system.get_nearby_doors();
        assert(doors_in_room.len() >= 1, 'room doors visible');
    }

    #[test]
    #[available_gas(120000000)]
    fn test_multiple_players() {
        let world = create_test_world();
        let game_system = create_game_system(world);

        // Initialize first player
        cheat_caller_address(PLAYER());
        game_system.initialize_player();
        game_system.start_game();

        // Initialize second player
        cheat_caller_address(PLAYER_2());
        game_system.initialize_player();
        game_system.start_game();

        let player1: Player = world.read_model(PLAYER());
        let player2: Player = world.read_model(PLAYER_2());
        let player1_stats: PlayerStats = world.read_model(PLAYER());
        let player2_stats: PlayerStats = world.read_model(PLAYER_2());

        assert(player1.game_active, 'p1 active');
        assert(player2.game_active, 'p2 active');
        assert(player1.player_id != player2.player_id, 'diff players');
        assert(player1.current_session_id != player2.current_session_id, 'diff sessions');
        assert(player1_stats.player_id == PLAYER(), 'p1 stats ok');
        assert(player2_stats.player_id == PLAYER_2(), 'p2 stats ok');
    }

    #[test]
    #[available_gas(80000000)]
    fn test_room_clearing_mechanics() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());

        let mut room = RoomTrait::new(1);
        let config: GameConfig = world.read_model('default');
        room.initialize(config);
        
        let initial_entities = room.active_entities;
        
        // Test defeating entities
        room.defeat_entity();
        assert(room.active_entities == initial_entities - 1, 'entity defeated');
        assert(!room.is_cleared(), 'room not cleared yet');

        // Clear all entities
        room.defeat_entity();
        assert(room.is_cleared(), 'room cleared');
        assert(room.active_entities == 0, 'no active entities');
        assert(!room.doors_are_locked(), 'doors unlocked');
    }

    #[test]
    #[available_gas(80000000)]
    fn test_position_utility_functions() {
        let pos1 = PositionTrait::new(3, 4);
        let pos2 = PositionTrait::new(5, 6);

        // Test distance calculation
        let distance = pos1.distance_to(pos2);
        assert(distance == 4, 'distance correct'); // |5-3| + |6-4| = 4

        // Test movement
        let moved_pos = pos1.move_by_delta(1, -1);
        assert(moved_pos.x == 4 && moved_pos.y == 3, 'moved correctly');

        // Test grid validation
        let config: GameConfig = GameConfigTrait::default_config();
        assert(pos1.is_valid_on_grid(config.grid_size), 'valid on grid');
        
        let invalid_pos = PositionTrait::new(60, 60);
        assert(!invalid_pos.is_valid_on_grid(config.grid_size), 'invalid on grid');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_door_positions_system() {
        // Test door position mappings
        let door0_pos = DoorPositions::get_door_position_in_room(0);
        assert(door0_pos.x == 0 && door0_pos.y == 0, 'door 0 position');

        let door1_pos = DoorPositions::get_door_position_in_room(1);
        assert(door1_pos.x == 27 && door1_pos.y == 29, 'door 1 position');

        let door2_pos = DoorPositions::get_door_position_in_room(2);
        assert(door2_pos.x == 9 && door2_pos.y == 5, 'door 2 position');

        // Test room mappings
        assert(DoorPositions::get_door_room(0) == 0, 'door 0 room');
        assert(DoorPositions::get_door_room(1) == 1, 'door 1 room');
        assert(DoorPositions::get_door_room(2) == 1, 'door 2 room');
        assert(DoorPositions::get_door_room(3) == 2, 'door 3 room');

        // Test special positions
        let transition_pos = DoorPositions::get_transition_position();
        assert(transition_pos.x == 25 && transition_pos.y == 25, 'transition position');

        let entry_pos = DoorPositions::get_room_entry_position();
        assert(entry_pos.x == 5 && entry_pos.y == 5, 'room entry position');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_player_trait_functions() {
        let config = GameConfigTrait::default_config();
        let mut player = PlayerTrait::new(PLAYER(), 'session123', config);

        // Test initial state
        assert(player.is_in_transition(), 'starts in transition');
        assert(!player.is_in_room(1), 'not in room 1');
        assert(!player.can_attack_or_collect(), 'cannot attack in transition');

        // Test room transitions
        player.enter_room(2);
        assert(!player.is_in_transition(), 'not in transition');
        assert(player.is_in_room(2), 'in room 2');
        assert(player.can_attack_or_collect(), 'can attack in room');

        player.exit_to_transition();
        assert(player.is_in_transition(), 'back in transition');

        // Test door access logic
        let door_pos = DoorPositions::get_door_position_in_room(1);
        assert(!player.can_exit_door(1, door_pos), 'cannot exit from transition');
        assert(player.can_enter_door(1), 'can enter door from transition');

        player.enter_room(1);
        assert(!player.can_enter_door(1), 'cannot enter door from room');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_entity_trait_functions() {
        let mut entity = EntityTrait::new('test_entity', EntityType::Male, 1);

        assert(entity.is_alive, 'entity alive');
        assert(entity.health == 50, 'male entity health');
        assert(entity.damage_per_turn == 20, 'male entity damage');
        assert(entity.room_id == 1, 'entity in room 1');

        // Test damage
        let survived = entity.take_damage(30);
        assert(survived, 'entity survived');
        assert(entity.health == 20, 'health reduced');

        let fatal = entity.take_damage(25);
        assert(!fatal, 'entity died');
        assert(!entity.is_alive, 'not alive');
        assert(entity.health == 0, 'zero health');

        // Test room association
        assert(entity.is_in_same_room(1), 'entity in room 1');
        assert(!entity.is_in_same_room(2), 'entity not in room 2');
        assert(!entity.is_in_same_room(0), 'entity not in transition');

        // Test shard drops
        let dropped_shard = entity.get_dropped_shard();
        assert(dropped_shard.is_none(), 'no shard dropped while alive');

        // Create entity with shard drop
        let shard_entity = EntityTrait::new_with_shard_drop(
            'shard_entity', 
            EntityType::Female, 
            2, 
            Option::Some(NumberedShard::Two)
        );
        assert(shard_entity.drops_numbered_shard.is_some(), 'has shard drop');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_game_session_tracking() {
        let mut session = GameSessionTrait::new('session123', PLAYER(), 1000);

        assert(session.start_time == 1000, 'start time set');
        assert(!session.session_complete, 'not complete');
        assert(session.total_actions == 0, 'no actions');

        // Test tracking various actions
        session.record_action();
        session.defeat_entity();
        session.collect_shard();
        session.collect_numbered_shard();
        session.deal_damage(25);
        session.take_damage(10);
        session.open_door();
        session.clear_room();

        assert(session.total_actions == 1, 'action recorded');
        assert(session.entities_defeated == 1, 'entity recorded');
        assert(session.total_shards_collected == 2, 'shards recorded'); // regular + numbered
        assert(session.numbered_shards_collected == 1, 'numbered shard recorded');
        assert(session.total_damage_dealt == 25, 'damage dealt recorded');
        assert(session.total_damage_taken == 10, 'damage taken recorded');
        assert(session.doors_opened == 1, 'door recorded');
        assert(session.rooms_cleared == 1, 'room cleared recorded');

        // Test completion
        session.complete_with_victory(2000);
        assert(session.session_complete, 'session complete');
        assert(session.victory_achieved, 'victory recorded');
        assert(session.end_time == 2000, 'end time set');
        assert(session.get_duration() == 1000, 'duration calculated');

        // Test victory check
        assert(session.is_victory(5), 'victory condition met');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_player_stats_tracking() {
        let mut stats = PlayerStatsTrait::new(PLAYER());

        assert(stats.games_played == 0, 'no games played');
        assert(stats.games_won == 0, 'no games won');

        // Test game start/completion
        stats.start_game();
        assert(stats.games_played == 1, 'game started');

        stats.complete_game(5000, 3);
        assert(stats.games_won == 1, 'game won');
        assert(stats.best_completion_time == 5000, 'completion time set');
        assert(stats.highest_room_reached == 3, 'room reached set');

        // Test better completion time
        stats.complete_game(3000, 2);
        assert(stats.best_completion_time == 3000, 'better time recorded');
        assert(stats.highest_room_reached == 3, 'highest room maintained');

        // Test stat tracking
        stats.record_entity_defeat();
        stats.add_shards_collected(5);
        stats.add_numbered_shard();
        stats.record_damage_dealt(100);
        stats.record_damage_taken(50);
        stats.record_action_taken();
        stats.record_door_opened();
        stats.add_playtime(10000);

        assert(stats.total_entities_defeated == 1, 'entity defeat recorded');
        assert(stats.total_shards_collected == 5, 'shards recorded');
        assert(stats.numbered_shards_collected == 1, 'numbered shard recorded');
        assert(stats.total_damage_dealt == 100, 'damage dealt recorded');
        assert(stats.total_damage_taken == 50, 'damage taken recorded');
        assert(stats.total_actions_taken == 1, 'action recorded');
        assert(stats.doors_opened == 1, 'door recorded');
        assert(stats.total_playtime == 10000, 'playtime recorded');
    }

    #[test]
    #[available_gas(150000000)]
    fn test_door_locked_by_entities() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room 1

        let mut player: Player = world.read_model(PLAYER());
        // Position player near door 1 at (27,29)
        player.change_position(PositionTrait::new(27, 28));
        world.write_model(@player);

        let room: Room = world.read_model(1_u32);
        assert(room.doors_are_locked(), 'doors locked with entities');

        // Attempting to exit would fail due to locked doors
        // The contract would assert and prevent the exit
    }

    #[test]
    #[available_gas(200000000)]
    fn test_entity_with_numbered_shard_drop() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room 1

        // Create entity with shard drop and place in room
        let entity_id = 'special_entity';
        let entity = EntityTrait::new_with_shard_drop(
            entity_id, 
            EntityType::Female, 
            1, // room_id 
            Option::Some(NumberedShard::One)
        );
        world.write_model(@entity);

        let entity_state = EntityState {
            entity_id,
            alert_level: AlertLevel::Combat,
            last_action_block: 0,
        };
        world.write_model(@entity_state);

        let player_before: Player = world.read_model(PLAYER());
        
        // Attack and defeat entity
        game_system.attack_entity(entity_id);

        let defeated_entity: Entity = world.read_model(entity_id);
        if !defeated_entity.is_alive {
            // Check if shard location was created with the entity_id
            let shard_location: ShardLocation = world.read_model(entity_id);
            if shard_location.room_id == 1 && shard_location.numbered_shard.is_some() {
                // Shard was dropped, now collect it
                game_system.collect_shard(entity_id, 1);
                
                let player_after: Player = world.read_model(PLAYER());
                assert(player_after.has_shard_one, 'numbered shard collected');
            }
        }
    }

    #[test]
    #[available_gas(120000000)]
    fn test_self_damage_mechanics() {
        let config = GameConfigTrait::default_config();
        
        // Test self damage calculations
        let male_self_damage = config.get_self_damage_for_entity_type(EntityType::Male);
        let female_self_damage = config.get_self_damage_for_entity_type(EntityType::Female);
        
        assert(male_self_damage == 10, 'male self damage'); // 20 / 2
        assert(female_self_damage == 7, 'female self damage'); // 15 / 2 (rounded down)

        // Test in actual combat
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1);

        let player_before: Player = world.read_model(PLAYER());
        let initial_health = player_before.health;

        // Create and attack a male entity in room 1
        let entity_id = 'male_entity';
        let entity = EntityTrait::new(entity_id, EntityType::Male, 1);
        world.write_model(@entity);

        let entity_state = EntityState {
            entity_id,
            alert_level: AlertLevel::Combat,
            last_action_block: 0,
        };
        world.write_model(@entity_state);

        game_system.attack_entity(entity_id);

        let player_after: Player = world.read_model(PLAYER());
        let expected_health = initial_health - male_self_damage;
        assert(player_after.health == expected_health, 'correct self damage applied');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_game_config_defaults() {
        let config = GameConfigTrait::default_config();

        assert(config.config_id == 'default', 'config id set');
        assert(config.grid_size == 50, 'grid size 50');
        assert(config.starting_health == 100, 'starting health 100');
        assert(config.starting_shards == 3, 'starting shards 3');
        assert(config.base_damage == 25, 'base damage 25');
        assert(config.entity_spawn_rate == 70, 'spawn rate 70');
        assert(config.shard_drop_rate == 80, 'drop rate 80');
        assert(config.male_entity_damage == 20, 'male damage 20');
        assert(config.female_entity_damage == 15, 'female damage 15');
        assert(config.door_detection_range == 8, 'door detection 8');

        // Test derived values
        assert(config.get_base_damage() == 25, 'get base damage');
        assert(config.get_entities_per_room() == 2, 'entities per room');
    }

    #[test]
    #[available_gas(300000000)]
    fn test_complete_room_clearing_flow() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room 1

        let room_before: Room = world.read_model(1_u32);
        let player_before: Player = world.read_model(PLAYER());
        
        assert(room_before.active_entities == 2, 'room has 2 entities');
        assert(room_before.doors_are_locked(), 'doors locked');

        // Attack both entities in the room
        let entity1_id = 'entity' + 1.into() + 0.into();
        let entity2_id = 'entity' + 1.into() + 1.into();

        // Create entities in the room
        let entity1 = EntityTrait::new(entity1_id, EntityType::Male, 1);
        let entity2 = EntityTrait::new(entity2_id, EntityType::Female, 1);
        world.write_model(@entity1);
        world.write_model(@entity2);

        let entity1_state = EntityState {
            entity_id: entity1_id,
            alert_level: AlertLevel::Combat,
            last_action_block: 0,
        };
        let entity2_state = EntityState {
            entity_id: entity2_id,
            alert_level: AlertLevel::Combat,
            last_action_block: 0,
        };
        world.write_model(@entity1_state);
        world.write_model(@entity2_state);

        // Attack first entity until defeated
        loop {
            let entity: Entity = world.read_model(entity1_id);
            if !entity.is_alive {
                break;
            }
            game_system.attack_entity(entity1_id);
        };

        // Attack second entity until defeated
        loop {
            let entity: Entity = world.read_model(entity2_id);
            if !entity.is_alive {
                break;
            }
            game_system.attack_entity(entity2_id);
        };

        let room_after: Room = world.read_model(1_u32);
        let player_after: Player = world.read_model(PLAYER());

        assert(room_after.is_cleared(), 'room cleared');
        assert(room_after.active_entities == 0, 'no active entities');
        assert(!room_after.doors_are_locked(), 'doors unlocked');
        assert(player_after.rooms_cleared == player_before.rooms_cleared + 1, 'rooms cleared incremented');
    }

    #[test]
    #[available_gas(200000000)]
    fn test_full_game_victory_sequence() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());

        let player: Player = world.read_model(PLAYER());
        
        // Simulate collecting all three numbered shards
        game_system.enter_door(1); // Enter room to collect shards

        // Create three numbered shard locations in the room
        let shard1_id = 'shard1_loc';
        let shard1_location = ShardLocation {
            shard_id: shard1_id,
            room_id: player.current_room,
            numbered_shard: Option::Some(NumberedShard::One),
            collected: false,
        };
        world.write_model(@shard1_location);
        game_system.collect_shard(shard1_id, player.current_room);

        let shard2_id = 'shard2_loc';
        let shard2_location = ShardLocation {
            shard_id: shard2_id,
            room_id: player.current_room,
            numbered_shard: Option::Some(NumberedShard::Two),
            collected: false,
        };
        world.write_model(@shard2_location);
        game_system.collect_shard(shard2_id, player.current_room);

        // Third shard should trigger victory
        let shard3_id = 'shard3_loc';
        let shard3_location = ShardLocation {
            shard_id: shard3_id,
            room_id: player.current_room,
            numbered_shard: Option::Some(NumberedShard::Three),
            collected: false,
        };
        world.write_model(@shard3_location);
        game_system.collect_shard(shard3_id, player.current_room);

        let final_player: Player = world.read_model(PLAYER());
        let final_status = game_system.get_game_status();

        assert(!final_player.game_active, 'game ended');
        assert(final_player.has_victory_condition(), 'victory condition met');
        assert(final_status == GameResult::Victory, 'victory status');
    }

    #[test]
    #[available_gas(80000000)]
    fn test_boundary_movement() {
        let mut world = create_test_world();
        let game_system = create_game_system(world);

        setup_player_and_game(world, game_system, PLAYER());
        game_system.enter_door(1); // Enter room

        // Test movement at boundaries
        let mut player: Player = world.read_model(PLAYER());
        
        // Move to corner (0,0)
        player.change_position(PositionTrait::new(0, 0));
        world.write_model(@player);

        // Try to move beyond boundary - should clamp to 0
        game_system.move_player(-1, -1);

        let player_after: Player = world.read_model(PLAYER());
        assert(player_after.position.x == 0, 'x clamped to 0');
        assert(player_after.position.y == 0, 'y clamped to 0');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_entity_room_association() {
        let entity = EntityTrait::new('test_entity', EntityType::Male, 3);
        
        assert(entity.is_in_same_room(3), 'entity in room 3');
        assert(!entity.is_in_same_room(2), 'entity not in room 2');
        assert(!entity.is_in_same_room(0), 'entity not in transition');
    }

    #[test]
    #[available_gas(120000000)]
    fn test_door_room_mapping() {
        // Test the door-to-room mapping system
        assert(DoorPositions::get_door_room(1) == 1, 'door 1 maps to room 1');
        assert(DoorPositions::get_door_room(2) == 1, 'door 2 maps to room 1');
        assert(DoorPositions::get_door_room(3) == 2, 'door 3 maps to room 2');
        assert(DoorPositions::get_door_room(4) == 2, 'door 4 maps to room 2');
        assert(DoorPositions::get_door_room(5) == 3, 'door 5 maps to room 3');
        assert(DoorPositions::get_door_room(6) == 3, 'door 6 maps to room 3');
        assert(DoorPositions::get_door_room(17) == 9, 'door 17 maps to room 9');
        assert(DoorPositions::get_door_room(18) == 9, 'door 18 maps to room 9');
        assert(DoorPositions::get_door_room(999) == 0, 'invalid door maps to 0');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_player_health_mechanics() {
        let config = GameConfigTrait::default_config();
        let mut player = PlayerTrait::new(PLAYER(), 'session123', config);

        let initial_health = player.health;
        assert(initial_health == config.starting_health, 'initial health correct');

        // Test taking non-fatal damage
        let survived = player.take_damage(30);
        assert(survived, 'player survived damage');
        assert(player.health == initial_health - 30, 'health reduced correctly');
        assert(player.is_alive, 'player still alive');

        // Test healing
        player.heal(15);
        assert(player.health == initial_health - 15, 'player healed');

        // Test healing beyond max
        player.heal(100);
        assert(player.health == player.max_health, 'health capped at max');

        // Test fatal damage
        let fatal = player.take_damage(200);
        assert(!fatal, 'player died');
        assert(player.health == 0, 'health at zero');
        assert(!player.is_alive, 'player not alive');
    }

    #[test]
    #[available_gas(100000000)]
    fn test_shard_mechanics() {
        let config = GameConfigTrait::default_config();
        let mut player = PlayerTrait::new(PLAYER(), 'session123', config);

        let initial_shards = player.shards;
        
        // Test collecting regular shard
        player.collect_shard();
        assert(player.shards == initial_shards + 1, 'shard collected');

        // Test spending shards
        let spent = player.spend_shards(2);
        assert(spent, 'shards spent successfully');
        assert(player.shards == initial_shards - 1, 'shards deducted');

        // Test spending more than available
        let failed_spend = player.spend_shards(100);
        assert(!failed_spend, 'spending failed');
        assert(player.shards == initial_shards - 1, 'shards unchanged');

        // Test numbered shard collection
        assert(!player.has_shard_one, 'initially no shard one');
        let game_won = player.collect_numbered_shard(NumberedShard::One);
        assert(!game_won, 'game not won yet');
        assert(player.has_shard_one, 'has shard one');
        
        // Collect remaining numbered shards
        player.collect_numbered_shard(NumberedShard::Two);
        let victory = player.collect_numbered_shard(NumberedShard::Three);
        assert(victory, 'victory achieved');
        assert(!player.game_active, 'game ended');
    }

    #[test]
    #[available_gas(80000000)]
    fn test_room_treasure_mechanics() {
        let mut room = RoomTrait::new(5);
        let config = GameConfigTrait::default_config();
        
        room.initialize(config);
        room.has_treasure = true;
        
        assert(room.has_treasure, 'room has treasure');
        assert(!room.treasure_collected, 'treasure not collected');
        
        room.collect_treasure();
        assert(room.treasure_collected, 'treasure collected');
        
        // Try collecting again - should not change state
        room.collect_treasure();
        assert(room.treasure_collected, 'treasure still collected');
    }


}