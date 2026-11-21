use serde::{Deserialize, Serialize};

use crate::table::Stage;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Action {
    Fold,
    Check,
    Call,
    /// Raise to a total bet of `amount` for this street.
    Raise { amount: u64 },
    AllIn,
}

/// Character appearance. Every field is an index into the options shown in the
/// client's character creator; all characters share the same options, and
/// `tone`/`hair` pick from that character's own swatches.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Look {
    /// Man, Woman, Cake face, Squirrel, Cat, Queen, Baby.
    pub character: u8,
    pub tone: u8,
    pub hair: u8,
    pub accent: u8,
    pub hat: u8,
    pub glasses: bool,
}

impl Look {
    pub const CHARACTER_COUNT: u8 = 7;
    /// Tones, hair swatches, accent colours and headwear each have this many choices.
    pub const OPTION_COUNT: u8 = 4;

    pub fn is_valid(&self) -> bool {
        self.character < Self::CHARACTER_COUNT
            && [self.tone, self.hair, self.accent, self.hat].iter().all(|&v| v < Self::OPTION_COUNT)
    }
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ClientMsg {
    Sit {
        seat: usize,
        #[serde(default)]
        look: Option<Look>,
    },
    Stand,
    AddBot,
    RemoveBots,
    Act { action: Action },
    Chat { text: String },
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerMsg {
    State { state: TableView },
    Error { message: String },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSummary {
    pub code: String,
    pub name: String,
    pub small_blind: u64,
    pub big_blind: u64,
    pub buy_in: u64,
    pub max_seats: usize,
    pub private: bool,
    pub players: usize,
    pub stage: Stage,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Award {
    pub seat: usize,
    pub amount: u64,
    pub hand: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub name: String,
    pub text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeatView {
    pub seat: usize,
    pub name: String,
    pub look: Look,
    pub is_bot: bool,
    pub stack: u64,
    pub bet: u64,
    pub in_hand: bool,
    pub folded: bool,
    pub all_in: bool,
    pub leaving: bool,
    pub is_you: bool,
    pub is_button: bool,
    pub is_turn: bool,
    pub hole: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionsView {
    pub can_check: bool,
    pub to_call: u64,
    pub min_raise_to: u64,
    pub max_raise_to: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableView {
    pub code: String,
    pub name: String,
    pub small_blind: u64,
    pub big_blind: u64,
    pub buy_in: u64,
    pub max_seats: usize,
    pub private: bool,
    pub stage: Stage,
    pub board: Vec<String>,
    pub pot: u64,
    pub current_bet: u64,
    pub min_raise: u64,
    pub button: Option<usize>,
    pub to_act: Option<usize>,
    pub turn_ms_left: Option<u64>,
    pub seats: Vec<Option<SeatView>>,
    pub you: Option<usize>,
    pub actions: Option<ActionsView>,
    pub your_hand: Option<String>,
    pub hand_id: u64,
    pub awards: Vec<Award>,
    pub reveal: bool,
    pub log: Vec<String>,
    pub chat: Vec<ChatMessage>,
    pub viewers: usize,
}
