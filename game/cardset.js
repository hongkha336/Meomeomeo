import $ from "./constants";

/**
 * A set of cards played by the player.
 * @param {Object} player The owner of the set
 * @param {Array} cards  An array of cards in the set
 */
class CardSet {
  constructor(player, cards) {
    /**
       * Generate a random id
       * @returns {String}   A random id
       */
    this.generateRandomID = () =>
      `_${Math.random()
        .toString(36)
        .substr(2, 9)}`;

    //The set id
    this.id = this.generateRandomID();

    //The owner of the set
    this.owner = player;

    //The cards in the set
    this.cards = cards;

    //The effects of the card has been played
    this.effectPlayed = false;

    //If a nope was played on this card set
    this.nopePlayed = false;

    //Number of nopes played on this set
    this.nopeAmount = 0;
  }

  /**
   * Whether the set is has no cards
   * @returns {Boolean} True if set has no cards else false
   */
  isEmpty() {
    return this.cards.length < 1;
  }

  /**
   * Get the index of a card in the set by id
   * @param   {String} id Card id
   * @returns {Number} The index of the card or -1 if not found
   */
  cardIndexById(id) {
    for (const key in this.cards) {
      const card = this.cards[key];
      if (card.id === id) return key;
    }
    return -1;
  }

  /**
   * Whether the card set has a card with given id
   * @param   {String} id The card id
   * @returns {Boolean}  True if the set has the card else false
   */
  hasCardWithId(id) {
    return this.cardIndexById(id) >= 0;
  }

  /**
   * Whether the card set has a card of a certain type
   * @param   {String}  type The card type
   * @returns {Boolean} True if the set has the card else false
   */
  hasCardType(type) {
    for (const key in this.cards) {
      const card = this.cards[key];
      if (card.type === type) return true;
    }
    return false;
  }

  /**
   * Remove a card type from the set
   * @param   {String}   type The card type
   * @returns {Object} The card or null
   */
  removeCardType(type) {
    if (this.hasCardType(type)) {
      let chosenCard = null;
      for (const key in this.cards) {
        const card = this.cards[key];
        if (card.type === type) {
          chosenCard = card;
          break;
        }
      }

      if (chosenCard) {
        this.cards.splice(this.cards.indexOf(chosenCard), 1);
      }

      return chosenCard;
    }
    return null;
  }

  /**
   * Remove a card with given id from the cards
   * @param   {String} id The card id
   * @returns {Object} The card or null
   */
  removeCardWithId(id) {
    const index = this.cardIndexById(id);
    return index >= 0 ? this.cards.splice(index, 1)[0] : null;
  }

  /**
   * Whether the current card set can be used to steal.
   * E.g Blind steal, Named steal or Discard steal.
   *
   * @returns {String} The type of steal the card set can do.
   */
  canSteal() {
    switch (this.cards.length) {
      case 2:
        //Player needs to have matching cards
        return this.cardsMatching() ? $.CARDSET.STEAL.BLIND : $.CARDSET.STEAL.INVALID;
        break;
      case 3:
        //Player needs to have matching cards
        return this.cardsMatching() ? $.CARDSET.STEAL.NAMED : $.CARDSET.STEAL.INVALID;
        break;
      case 5:
        //Player needs to have different cards
        return this.cardsDifferent() ? $.CARDSET.STEAL.DISCARD : $.CARDSET.STEAL.INVALID;
        break;
      default:
        return $.CARDSET.STEAL.INVALID;
    }
    return $.CARDSET.STEAL.INVALID;
  }

  /**
   * Whether the cards in the set are all matching
   * @returns {Boolean} True if all cards are matching else false
   */
  cardsMatching() {
    if (this.cards.length > 0) {
      //Easiest way to check if to get the first card and match it against the rest
      //Cards match if their types are same and the image displayed is the same
      const card = this.cards[0];
      for (let i = 1; i < this.cards.length; i++) {
        const compareCard = this.cards[i];
        const match = card.name === compareCard.name && card.type === compareCard.type;
        if (!match) return false;
      }

      return true;
    }
    return false;
  }

  /**
   * Whether the cards in the set are all different
   * @returns {Boolean} True if all cards are different else false
   */
  cardsDifferent() {
    if (this.cards.length > 1) {
      //O(n^2) method as we have to compare each card to another
      for (let i = 0; i < this.cards.length - 1; i++) {
        const card = this.cards[i];
        for (let j = i + 1; j < this.cards.length; j++) {
          const compareCard = this.cards[j];
          const match = card.name === compareCard.name && card.type === compareCard.type;
          if (match) return false;
        }
      }

      return true;
    }

    //If we just have 1 card then obviously it's different from the rest
    return this.cards.length == 1;
  }
}

export default CardSet;
