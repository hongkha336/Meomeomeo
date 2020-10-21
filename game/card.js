class Card {
  /**
   * A playing card
   * @param {String} id The card id
   * @param {String} name The name
   * @param {String} type The card type
   * @param {String} image The image
   */
  constructor(id, name, type, image) {
    //Card id
    this.id = id;

    //Card name to display
    this.name = name;

    //Card type
    this.type = type;

    //Card icon
    this.image = image;
  }
}

export default Card;
