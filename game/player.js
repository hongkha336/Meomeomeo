/**
 * A player instance for a given user for a specific game
 * @param {Object} user The user
 */
class Player {
  constructor(user) {
    //The user associated with the player
    this.user = user;

    //The current score
    this.alive = true;

    //Players hand
    this.hand = [];

    //The amount of cards player has to draw
    this.drawAmount = 1;

    //Set the player to ready
    this.ready = false;
  }

  /**
   * Reset the player
   */
  reset() {
    this.hand = [];
    this.alive = true;
    this.ready = false;
    this.drawAmount = 1;
  }

  /**
   * Get the index of the given card in players hand
   * @param   {Object} id The card id
   * @returns {Number} The position of the card in players hand
   */
  cardIndexById(id) {
    for (let i = 0; i < this.hand.length; i++) {
      if (this.hand[i].id === id) return i;
    }

    return -1;
  }

  /**
   * Get the first index of the given card type in players hand
   * @param   {String} type Card type
   * @returns {Number} The position of the first card type in players hand
   */
  cardTypeIndex(type) {
    for (let i = 0; i < this.hand.length; i++) {
      if (this.hand[i].type === type) return i;
    }

    return -1;
  }

  /**
   * Check if a player has a certain card
   * @param   {Object} card The card
   * @returns {Boolean} Whether the player has the card
   */
  hasCard(card) {
    return this.cardIndex(card) >= 0;
  }

  /**
   * Check if a player has a certain card with given id
   * @param   {Object} id The card id
   * @returns {Boolean} Whether the player has the card
   */
  hasCardWithId(id) {
    return this.cardIndexById(id) >= 0;
  }

  /**
   * Check if a player has cards with given ids
   * @param   {Array} ids An array of card ids
   * @returns {Boolean}  Whether the player has the cards
   */
  hasCardsWithId(ids) {
    for (const key in ids) {
      const id = ids[key];
      if (!this.hasCardWithId(id)) return false;
    }

    return true;
  }

  /**
   * Check if a player has a certain card type
   * @param   {String}   type The card type
   * @returns {Boolean} Whether the player has the card
   */
  hasCardType(type) {
    return this.cardTypeIndex(type) >= 0;
  }

  /**
   * Get cards from the players hands with given id
   * @param   {Array} ids An array of card ids
   * @returns {Array} An array of cards
   */
  getCardsWithId(ids) {
    const cards = [];
    for (const key in ids) {
      const id = ids[key];
      const cardIndex = this.cardIndexById(id);
      if (cardIndex >= 0) {
        cards.push(this.hand[cardIndex]);
      }
    }
    return cards;
  }

  /**
   * Get a random card from the players hand
   * @returns {Object} A random card or null
   */
  getRandomCard() {
    if (this.hand.length > 0) {
      const randomInt = Math.floor(Math.random() * (this.hand.length - 1));
      return this.hand[randomInt];
    }

    return null;
  }

  /**
   * Get a card of a certain type
   * @param   {Object} type [[Description]]
   * @returns {Object} The card of type or null
   */
  getCardType(type) {
    const index = this.cardTypeIndex(type);
    return index >= 0 ? this.hand[index] : null;
  }

  /**
   * Add a card to the players hand
   * @param {Object} card The card
   */
  addCard(card) {
    this.hand.push(card);
  }

  /**
   * Add cards to the players hand
   * @param {Array} cards An array of cards
   */
  addCards(cards) {
    for (const key in cards) {
      const card = cards[key];
      this.addCard(card);
    }
  }

  /**
   * Remove card from players hand
   * @param   {Object} card The card to remove
   * @returns {Object} The removed card or null.
   */
  removeCard({ id }) {
    return this.removeCardWithId(id);
  }

  /**
   * Remove cards from the players hand
   * @param {Array} cards An array of cards to remove
   */
  removeCards(cards) {
    for (const key in cards) {
      this.removeCard(cards[key]);
    }
  }

  /**
   * Remove card from players hand with given id
   * @param   {Object} id The card with id to remove
   * @returns {Object} The removed card or null.
   */
  removeCardWithId(id) {
    const index = this.cardIndexById(id);
    return index >= 0 ? this.hand.splice(index, 1)[0] : null;
  }

  /**
   * Remove cards from the players hands with given id
   * @param   {Array} ids An array of card ids
   * @returns {Array} An array of removed cards
   */
  removeCardsWithId(ids) {
    const cards = [];
    for (const key in ids) {
      const id = ids[key];
      cards.push(this.removeCardWithId(id));
    }
    return cards;
  }

  /**
   * Remove the first card type from players hand
   * @param   {String} type Card type
   * @returns {Object} The removed card or null
   */
  removeCardType(type) {
    const index = this.cardTypeIndex(type);
    return index >= 0 ? this.hand.splice(index, 1)[0] : null;
  }
}

export default Player;
