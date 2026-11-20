#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Suit {
    Clubs,
    Diamonds,
    Hearts,
    Spades,
}

const SUITS: [Suit; 4] = [Suit::Clubs, Suit::Diamonds, Suit::Hearts, Suit::Spades];

impl Suit {
    fn symbol(self) -> char {
        match self {
            Suit::Clubs => 'c',
            Suit::Diamonds => 'd',
            Suit::Hearts => 'h',
            Suit::Spades => 's',
        }
    }
}

/// Rank is 2..=14 where 14 is an ace.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Card {
    pub rank: u8,
    pub suit: Suit,
}

impl Card {
    /// Short notation such as "Ah" or "Td".
    pub fn code(&self) -> String {
        let rank = match self.rank {
            10 => 'T',
            11 => 'J',
            12 => 'Q',
            13 => 'K',
            14 => 'A',
            n => char::from_digit(n as u32, 10).unwrap_or('?'),
        };
        format!("{}{}", rank, self.suit.symbol())
    }
}

pub fn full_deck() -> Vec<Card> {
    SUITS
        .iter()
        .flat_map(|&suit| (2..=14).map(move |rank| Card { rank, suit }))
        .collect()
}
