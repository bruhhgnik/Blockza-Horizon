use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Introspect)]
pub enum EntityType {
    Male,        
    Female,      
}

#[derive(Copy, Drop, Serde, Introspect)]
pub enum AlertLevel {
    Idle,
    Alerted,    
    Combat,
}

#[derive(Copy, Drop, Serde, Introspect, PartialEq)]
pub enum GameResult {
    InProgress,
    Victory,
    Defeat,
}

#[derive(Copy, Drop, Serde, Introspect, PartialEq)]
pub enum NumberedShard {
    One,
    Two, 
    Three,
}

#[derive(Copy, Drop, Serde, Introspect, PartialEq)]
pub enum ActionType {
    Move,
    ExitDoor,
    EnterDoor,
    Attack,
    CollectShard,
}

#[derive(Copy, Drop, Serde)] 
pub struct MoveAction { 
    pub x_delta: i32,  
    pub y_delta: i32,  
}

#[derive(Copy, Drop, Serde)] 
pub struct ExitDoorAction { 
    pub door_id: u32,
}

#[derive(Copy, Drop, Serde)] 
pub struct EnterDoorAction { 
    pub door_id: u32,
}

#[derive(Copy, Drop, Serde)] 
pub struct AttackAction { 
    pub entity_id: felt252,
}

#[derive(Copy, Drop, Serde)]
pub struct CollectShardAction {
    pub action_id: felt252,
    pub room_id: u32,
}

#[derive(Copy, Drop, Serde)]
pub enum Action {
    Move: MoveAction,
    ExitDoor: ExitDoorAction,
    EnterDoor: EnterDoorAction,
    Attack: AttackAction,
    CollectShard: CollectShardAction,
}

#[derive(Copy, Drop, Serde)]
pub struct ActionResult {
    pub result_id: felt252,
    pub action_type: ActionType,
    pub success: bool,
    pub error_code: felt252,
    pub damage_dealt: u32,
    pub damage_taken: u32,
    pub shards_gained: u32,
    pub numbered_shard: Option<NumberedShard>,
    pub position_changed: bool,
    pub entity_defeated: bool,
    pub door_opened: bool,
    pub game_won: bool,
    pub room_changed: bool,
}

#[derive(Copy, Drop, Serde,Introspect)]
pub struct Position {
    pub x: u32,
    pub y: u32,
}

#[generate_trait]
pub impl PositionImpl of PositionTrait {
    fn new(x: u32, y: u32) -> Position {
        Position { x, y }
    }

    fn distance_to(self: Position, other: Position) -> u32 {
        let dx = if self.x > other.x { self.x - other.x } else { other.x - self.x };
        let dy = if self.y > other.y { self.y - other.y } else { other.y - self.y };
        dx + dy
    }

    fn move_by_delta(self: Position, x_delta: i32, y_delta: i32) -> Position {
        let new_x = if x_delta < 0 {
            if self.x > 0 { self.x - 1 } else { self.x }
        } else if x_delta > 0 {
            self.x + 1
        } else {
            self.x
        };

        let new_y = if y_delta < 0 {
            if self.y > 0 { self.y - 1 } else { self.y }
        } else if y_delta > 0 {
            self.y + 1
        } else {
            self.y
        };

        Position { 
            x: new_x, 
            y: new_y,
        }
    }

    fn is_valid_on_grid(self: Position, grid_size: u32) -> bool {
        self.x < grid_size && self.y < grid_size
    }
}

pub mod DoorPositions {
    use super::Position;
    use super::PositionTrait;
    
    pub fn get_door_position_in_room(door_id: u32) -> Position {
        match door_id {
            0 => PositionTrait::new(0, 0),
            1 => PositionTrait::new(23, 20),   
            2 => PositionTrait::new(24, 20),   
            3 => PositionTrait::new(22, 19),   
            4 => PositionTrait::new(21, 19),   
            5 => PositionTrait::new(22, 23),   
            6 => PositionTrait::new(22, 24),   
            7 => PositionTrait::new(17, 23), //room4  
            8 => PositionTrait::new(20, 22),   //room 5
            9 => PositionTrait::new(19, 23),   //room 5
            10 => PositionTrait::new(18, 22),  //room 6
            11 => PositionTrait::new(18, 21),  //room 6
            12 => PositionTrait::new(18, 19),  //room 7
            13 => PositionTrait::new(18, 20),  //room 7
            14 => PositionTrait::new(9, 5),  
            15 => PositionTrait::new(5, 0),  
            16 => PositionTrait::new(9, 5),  
            17 => PositionTrait::new(5, 0),  
            18 => PositionTrait::new(9, 5),  
            _ => PositionTrait::new(0, 0),   
        }
    }
    
    pub fn get_door_room(door_id: u32) -> u32 {
        match door_id {
         0 => 0,
    1 | 2 => 1,
    3 | 4 => 2,
    5 | 6 => 3,
    7 => 4,
    8 | 9 => 5,
    10 | 11 => 6,  
    12 | 13 => 7, 
    14 | 15 => 8,
    16 | 17 => 9,
    18 => 10,  
            _ => 0, 
        }
    }
    
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct GameConfig {
    #[key]
    pub config_id: felt252,
    pub grid_size: u32,
    pub starting_health: u32,
    pub starting_shards: u32,
    pub base_damage: u32,          
    pub entity_spawn_rate: u32,
    pub shard_drop_rate: u32,
    pub male_entity_damage: u32,
    pub female_entity_damage: u32,
    pub door_detection_range: u32,
}

#[generate_trait]
pub impl GameConfigImpl of GameConfigTrait {
    fn default_config() -> GameConfig {
        GameConfig {
            config_id: 'default',
            grid_size: 50,
            starting_health: 100,
            starting_shards: 3,
            base_damage: 25,          
            entity_spawn_rate: 70,
            shard_drop_rate: 95,
            male_entity_damage: 20,
            female_entity_damage: 15,
            door_detection_range: 8,
        }
    }

    fn get_base_damage(self: GameConfig) -> u32 {
        self.base_damage
    }

    fn get_entities_per_room(self: GameConfig) -> u32 {
        1 
    }
    
    fn get_self_damage_for_entity_type(self: GameConfig, entity_type: EntityType) -> u32 {
        match entity_type {
            EntityType::Male => self.male_entity_damage / 2, 
            EntityType::Female => self.female_entity_damage / 2,
        }
    }
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct Player {
    #[key]
    pub player_id: ContractAddress,
    pub position: Position,
    pub current_room: u32, 
    pub health: u32,
    pub max_health: u32,
    pub shards: u32,
    pub game_active: bool,
    pub is_alive: bool,
    pub current_session_id: felt252,
    pub rooms_cleared: u32,
    pub has_shard_one: bool,
    pub has_shard_two: bool,
    pub has_shard_three: bool, 
    pub special_ability_cooldown: u32,
    pub has_key: bool,
}

#[generate_trait]
pub impl PlayerImpl of PlayerTrait {
    fn new(player_id: ContractAddress, session_id: felt252, config: GameConfig) -> Player {
        Player {
            player_id,
            position: PositionTrait::new(25, 25), 
            current_room: 0, 
            health: config.starting_health,
            max_health: config.starting_health,
            shards: config.starting_shards,
            game_active: true,
            is_alive: true,
            current_session_id: session_id,
            rooms_cleared: 0,
            has_shard_one: false,
            has_shard_two: false,
            has_shard_three: false,
            special_ability_cooldown: 0,
            has_key: false,
        }
    }

    fn take_damage(ref self: Player, damage: u32) -> bool {
        if damage >= self.health {
            self.health = 0;
            self.is_alive = false;
            false
        } else {
            self.health -= damage;
            true
        }
    }

    fn collect_numbered_shard(ref self: Player, shard: NumberedShard) -> bool {
        match shard {
            NumberedShard::One => { self.has_shard_one = true; },
            NumberedShard::Two => { self.has_shard_two = true; },
            NumberedShard::Three => { self.has_shard_three = true; },
        }

        if self.has_shard_one && self.has_shard_two && self.has_shard_three {
            self.game_active = false; 
            self.has_key = true;
            true
        } else {
            false
        }
    }

    fn collect_shard(ref self: Player) {
        self.shards += 1;
    }

    fn spend_shards(ref self: Player, amount: u32) -> bool {
        if self.shards >= amount {
            self.shards -= amount;
            true
        } else {
            false
        }
    }

    fn change_position(ref self: Player, new_position: Position) {
        self.position = new_position;
    }

    fn enter_room(ref self: Player, room_id: u32) {
        self.current_room = room_id; 
    }

    fn exit_to_transition(ref self: Player) {
        self.current_room = 0;
    }

    fn clear_room(ref self: Player) {
        self.rooms_cleared += 1;
    }

    fn respawn(ref self: Player) {
        self.current_room = 0; 
        self.health = self.max_health;
        self.is_alive = true;
        self.shards = self.shards / 2;
    }

    fn end_game(ref self: Player) {
        self.game_active = false;
    }

    fn heal(ref self: Player, amount: u32) {
        let new_health = self.health + amount;
        if new_health > self.max_health {
            self.health = self.max_health;
        } else {
            self.health = new_health;
        }
    }

    fn has_victory_condition(self: Player) -> bool {
        self.has_shard_one && self.has_shard_two && self.has_shard_three
    }

    fn is_in_transition(self: Player) -> bool {
        self.current_room == 0
    }

    fn is_in_room(self: Player, room_id: u32) -> bool {
        self.current_room == room_id && room_id > 0
    }

    fn can_attack_or_collect(self: Player) -> bool {
        self.current_room > 0 
    }

    fn can_exit_door(self: Player, door_id: u32, door_position: Position) -> bool {
        if self.current_room == 0 {
            return false; 
        }
        
        let door_room = DoorPositions::get_door_room(door_id);
        if self.current_room != door_room {
            return false; 
        }
        
        self.position.distance_to(door_position) <= 7
    }

    fn can_enter_door(self: Player, door_id: u32) -> bool {
        if self.current_room != 0 {
            return false; 
        }
        
        let target_room = DoorPositions::get_door_room(door_id);
        let door_position = DoorPositions::get_door_position_in_room(door_id);
         
        target_room > 0 && self.position.distance_to(door_position) <= 7
    }
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct PlayerStats {
    #[key]
    pub player_id: ContractAddress,
    pub games_played: u32,
    pub games_won: u32,
    pub total_shards_collected: u32,
    pub total_entities_defeated: u32,
    pub total_playtime: u64,
    pub best_completion_time: u64,
    pub highest_room_reached: u32,
    pub total_damage_dealt: u32,
    pub total_damage_taken: u32,
    pub doors_opened: u32,
    pub total_actions_taken: u32,
    pub numbered_shards_collected: u32,
}

#[generate_trait]
pub impl PlayerStatsImpl of PlayerStatsTrait {
    fn new(player_id: ContractAddress) -> PlayerStats {
        PlayerStats {
            player_id,
            games_played: 0,
            games_won: 0,
            total_shards_collected: 0,
            total_entities_defeated: 0,
            total_playtime: 0,
            best_completion_time: 0,
            highest_room_reached: 0,
            total_damage_dealt: 0,
            total_damage_taken: 0,
            doors_opened: 0,
            total_actions_taken: 0,
            numbered_shards_collected: 0,
        }
    }

    fn start_game(ref self: PlayerStats) {
        self.games_played += 1;
    }

    fn complete_game(ref self: PlayerStats, completion_time: u64, rooms_reached: u32) {
        self.games_won += 1;
        if self.best_completion_time == 0 || completion_time < self.best_completion_time {
            self.best_completion_time = completion_time;
        }
        if rooms_reached > self.highest_room_reached {
            self.highest_room_reached = rooms_reached;
        }
    }

    fn add_playtime(ref self: PlayerStats, duration: u64) {
        self.total_playtime += duration;
    }

    fn record_entity_defeat(ref self: PlayerStats) {
        self.total_entities_defeated += 1;
    }

    fn add_shards_collected(ref self: PlayerStats, amount: u32) {
        self.total_shards_collected += amount;
    }

    fn add_numbered_shard(ref self: PlayerStats) {
        self.numbered_shards_collected += 1;
    }

    fn record_damage_dealt(ref self: PlayerStats, damage: u32) {
        self.total_damage_dealt += damage;
    }

    fn record_damage_taken(ref self: PlayerStats, damage: u32) {
        self.total_damage_taken += damage;
    }

    fn record_action_taken(ref self: PlayerStats) {
        self.total_actions_taken += 1;
    }

    fn record_door_opened(ref self: PlayerStats) {
        self.doors_opened += 1;
    }
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct Room {
    #[key]
    pub room_id: u32, 
    pub initialized: bool,
    pub cleared: bool,
    pub entity_count: u32,
    pub active_entities: u32,
    pub has_treasure: bool,
    pub treasure_collected: bool,
}

#[generate_trait]
pub impl RoomImpl of RoomTrait {
    fn new(room_id: u32) -> Room {
        Room {
            room_id,
            initialized: false,
            cleared: false,
            entity_count: 0,
            active_entities: 0,
            has_treasure: false,
            treasure_collected: false,
        }
    }

    fn initialize(ref self: Room, config: GameConfig) {
        self.initialized = true;
        self.entity_count = config.get_entities_per_room();
        self.active_entities = self.entity_count;
    }

    fn defeat_entity(ref self: Room) {
        if self.active_entities > 0 {
            self.active_entities -= 1;
        }
        
        if self.active_entities == 0 {
            self.cleared = true;
        }
    }

    fn is_cleared(self: Room) -> bool {
        self.cleared
    }

    fn has_living_entities(self: Room) -> bool {
        self.active_entities > 0
    }

    fn doors_are_locked(self: Room) -> bool {
        self.has_living_entities()
    }

    fn collect_treasure(ref self: Room) {
        if self.has_treasure && !self.treasure_collected {
            self.treasure_collected = true;
        }
    }
}

// Simplified Entity without position
#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct Entity {
    #[key]
    pub entity_id: felt252,
    pub entity_type: EntityType,
    pub room_id: u32,  // Only room_id, no position
    pub health: u32,
    pub max_health: u32,
    pub is_alive: bool,
    pub damage_per_turn: u32,
    pub drops_numbered_shard: Option<NumberedShard>,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct EntityState {
    #[key]
    pub entity_id: felt252,
    pub alert_level: AlertLevel,
    pub last_action_block: u64,
}

#[generate_trait]
pub impl EntityImpl of EntityTrait {
    fn new(entity_id: felt252, entity_type: EntityType, room_id: u32) -> Entity {
        let (health, damage) = match entity_type {
            EntityType::Male => (50, 20),
            EntityType::Female => (40, 15),
        };

        Entity {
            entity_id,
            entity_type,
            room_id,
            health,
            max_health: health,
            is_alive: true,
            damage_per_turn: damage,
            drops_numbered_shard: Option::None,
        }
    }

    fn new_with_shard_drop(entity_id: felt252, entity_type: EntityType, room_id: u32, shard_drop: Option<NumberedShard>) -> Entity {
        let (health, damage) = match entity_type {
            EntityType::Male => (50, 20),
            EntityType::Female => (40, 15),
        };

        Entity {
            entity_id,
            entity_type,
            room_id,
            health,
            max_health: health,
            is_alive: true,
            damage_per_turn: damage,
            drops_numbered_shard: shard_drop,
        }
    }

    fn take_damage(ref self: Entity, damage: u32) -> bool {
        if damage >= self.health {
            self.health = 0;
            self.is_alive = false;
            false
        } else {
            self.health -= damage;
            true
        }
    }

    fn is_in_same_room(self: Entity, player_room: u32) -> bool {
        self.room_id == player_room && player_room > 0
    }

    fn get_dropped_shard(self: Entity) -> Option<NumberedShard> {
        if !self.is_alive {
            self.drops_numbered_shard
        } else {
            Option::None
        }
    }
}

#[derive(Copy, Drop, Serde)]
#[dojo::model]
pub struct GameSession {
    #[key]
    pub session_id: felt252,
    pub player_id: ContractAddress,
    pub start_time: u64,
    pub end_time: u64,
    pub rooms_cleared: u32,
    pub total_shards_collected: u32,
    pub numbered_shards_collected: u32,
    pub entities_defeated: u32,
    pub total_damage_dealt: u32,
    pub total_damage_taken: u32,
    pub doors_opened: u32,
    pub deaths: u32,
    pub session_complete: bool,
    pub total_actions: u32,
    pub victory_achieved: bool,
}

#[generate_trait]
pub impl GameSessionImpl of GameSessionTrait {
    fn new(session_id: felt252, player_id: ContractAddress, start_time: u64) -> GameSession {
        GameSession {
            session_id,
            player_id,
            start_time,
            end_time: 0,
            rooms_cleared: 0,
            total_shards_collected: 0,
            numbered_shards_collected: 0,
            entities_defeated: 0,
            total_damage_dealt: 0,
            total_damage_taken: 0,
            doors_opened: 0,
            deaths: 0,
            session_complete: false,
            total_actions: 0,
            victory_achieved: false,
        }
    }

    fn clear_room(ref self: GameSession) {
        self.rooms_cleared += 1;
    }

    fn collect_shard(ref self: GameSession) {
        self.total_shards_collected += 1;
    }

    fn collect_numbered_shard(ref self: GameSession) {
        self.numbered_shards_collected += 1;
        self.total_shards_collected += 1;
    }

    fn defeat_entity(ref self: GameSession) {
        self.entities_defeated += 1;
    }

    fn deal_damage(ref self: GameSession, damage: u32) {
        self.total_damage_dealt += damage;
    }

    fn take_damage(ref self: GameSession, damage: u32) {
        self.total_damage_taken += damage;
    }

    fn open_door(ref self: GameSession) {
        self.doors_opened += 1;
    }

    fn record_death(ref self: GameSession) {
        self.deaths += 1;
    }

    fn complete_with_victory(ref self: GameSession, end_time: u64) {
        self.end_time = end_time;
        self.session_complete = true;
        self.victory_achieved = true;
    }

    fn end_session(ref self: GameSession, end_time: u64) {
        self.end_time = end_time;
        self.session_complete = true;
    }

    fn get_duration(self: GameSession) -> u64 {
        if self.end_time > 0 {
            self.end_time - self.start_time
        } else {
            0
        }
    }

    fn record_action(ref self: GameSession) {
        self.total_actions += 1;
    }

    fn is_victory(self: GameSession, rooms_for_victory: u32) -> bool {
        self.victory_achieved || self.rooms_cleared >= rooms_for_victory
    }
}

#[derive(Copy, Drop, Serde, Introspect)]
pub struct ActionValidation {
    pub validation_id: felt252,
    pub player_id: ContractAddress,
    pub action_type: ActionType,
    pub is_valid: bool,
    pub error_reason: felt252,
    pub required_shards: u32,
    pub required_health: u32,
    pub required_position: Position,
}

#[derive(Copy, Drop, Serde, Introspect)]
#[dojo::model]
pub struct ShardLocation {
    #[key]
    pub shard_id: felt252,  
    pub room_id: u32,
    pub numbered_shard: Option<NumberedShard>,
    pub collected: bool,
}