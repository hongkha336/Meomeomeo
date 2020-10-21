import Player from "./player";
import $ from "./constants";
import Card from "./card";
import CardSet from "./cardset";

// var $ = require('./constants');
// var Card = require('./card');
// var CardSet = require('./cardset');

/**
 * A game on the server
 * @param {Object} id  The game id
 * @param {String} title The game title
 */
class Game {
  constructor(id, title) {
    //Game id
    this.id = id;

    //Game title
    this.title = title;

    //Game status. WAITING or PLAYING.
    this.status = $.GAME.STATUS.WAITING;

    //Array of connected players
    this.players = [];

    //Cards in the draw pile
    this.drawPile = [];

    //Cards in the discard pile
    this.discardPile = [];

    //Index of the current user playing
    this.cUserIndex = 0;

    //Min players to start the game
    this.minPlayers = 2;

    //The turn direction (1 = top to bottom, -1 = bottom to top)
    this.direction = 1;

    //*************** Settings *******************

    //Amount of players allowed in game
    this.maxPlayers = 8;

    //The amount of time before nopes stop in milliseconds
    this.nopeTime = 5000;
  }

  /**
	 * Return a sanitized version of the game
	 * @returns {Object} A sanitized version of the game
	 */
  sanitize() {
    return {
      id: this.id,
      title: this.title,
      status: this.status,
      players: this.getPlayers(),
      currentPlayerIndex: this.cUserIndex,
      drawPileLength: this.drawPile.length,
      nopeTime: this.nopeTime
    };
  }

  /**
	 * Add a player to the game
	 * @param   {Object} user A user
	 * @returns {Boolean}  Whether adding a player is successful
	 */
  addPlayer(user) {
    if (this.status === $.GAME.STATUS.PLAYING) return false;
    const connected = this.isPlayerConnected(user);

    if (this.players.length + 1 > this.maxPlayers || connected) return false;

    if (!connected) this.players.push(new Player(user));

    return true;
  }

  /**
     * Remove a player from the game
     * @param {Object} user A user
     */
  removePlayer(user) {
    const index = this.playerIndexForUser(user);
    if (index >= 0) this.players.splice(index, 1);
  }

  /**
     * Get a sanitized version of game players.
     * This makes sure you don't send hand data to the others
     * @returns {Array} An array of players
     */
  getPlayers() {
    const players = [];
    for (const key in this.players) {
      const player = this.players[key];
      players.push({
        user: player.user,
        ready: player.ready,
        alive: player.alive,
        drawAmount: player.drawAmount,
        cardCount: player.hand.length
      });
    }

    return players;
  }

  /**
     * Get a player for the associated user
     * @param   {Object} user The user
     * @returns {Object} Returns player or null
     */
  getPlayer(user) {
    const index = this.playerIndexForUser(user);
    return index >= 0 ? this.players[index] : null;
  }

  /**
     * The current game host.
     * It is always the first person in the array
     * @returns {Object} Returns a user or null
     */
  gameHost() {
    return this.players.length > 0 ? this.players[0].user : null;
  }

  /**
     * The player index for a given user in connected player array.
     * @param   {Object} user The user
     * @returns {Number} Returns index if found else -1
     */
  playerIndexForUser(user) {
    for (let i = 0; i < this.players.length; i++) {
      const player = this.players[i];
      if (player.user === user) return i;
    }

    return -1;
  }

  /**
	 * Check whether a player is connected to the game
	 * @param   {Object} user The user associated with the player
	 * @returns {Boolean} Whether player is connected
	 */
  isPlayerConnected(user) {
    return this.playerIndexForUser(user) >= 0;
  }

  /**
     * Generate a random id
     * @returns {String}   A random id
     */
  generateRandomID() {
    return `_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  /**
     * Start the game.
     *
     * @returns {Boolean} If game started
     */
  start() {
    //Check if we can start/have already started
    if (this.players.length < this.minPlayers || this.status === $.GAME.STATUS.PLAYING)
      return false;

    //Only start if all the players are ready
    for (var key in this.players) {
      var player = this.players[key];
      if (!player.ready) return false;
    }

    //We call a reset incase
    this.reset();
    this.status = $.GAME.STATUS.PLAYING;

    //Give each player a diffuse and 4 random card from the pile
    for (var key in this.players) {
      var player = this.players[key];
      player.addCard(new Card(this.generateRandomID(), "Defuse", $.CARD.DEFUSE, "a"));
      this.drawCards(player, 4);
    }

    //Add in bombs
    for (var i = 0; i < this.players.length - 1; i++) {
      this.drawPile.push(new Card(this.generateRandomID(), "Explode", $.CARD.EXPLODE, 0));
    }

    //Add in extra defuses to negate the lack of nopes
    const multiplier = this.players.length > 5 ? 2 : 1;
    const count = 6 * multiplier - this.players.length;
    for (var i = 0; i < count; i++) {
      this.drawPile.push(new Card(this.generateRandomID(), "Defuse", $.CARD.DEFUSE, 0));
    }

    this.shuffleDeck();

    return true;
  }

  /**
     * Stop the game
     * @returns {Boolean} If game stopped
     */
  stop() {
    if (
      (this.playerAliveCount() < 2 || this.players.length < this.minPlayers) &&
      this.status === $.GAME.STATUS.PLAYING
    ) {
      this.reset();
      this.status = $.GAME.STATUS.WAITING;
      return true;
    }
    return false;
  }

  /**
     * Count the amount of players alive
     * @returns {Number} Amount of players alive
     */
  playerAliveCount() {
    let count = 0;
    for (const key in this.players) {
      const player = this.players[key];
      if (player.alive) {
        count += 1;
      }
    }

    return count;
  }

  /**
     * Increment a given index and return the new value
     * @param {Number} index The index to increment
     * @returns {Number} The next index
     */
  increment(index) {
    if (index + this.direction < 0) {
      index = this.players.length - 1;
    } else if (index + this.direction >= this.players.length) {
      index = 0;
    } else {
      index += this.direction;
    }

    return index;
  }

  /**
     * Get the index of the next alive player
     * @param   {Number} start The start index
     * @returns {Number} The index of the next player
     */
  getNextAliveIndex(start) {
    let next = this.increment(start);

    //Go to the next alive player
    while (this.playerAliveCount() > 1 && !this.players[next].alive) {
      next = this.increment(next);
    }

    return next;
  }

  /**
     * Get the next alive player
     * @param   {Number} start The start index
     * @returns {Object} The next alive player
     */
  getNextAlive(start) {
    return this.players[this.getNextAliveIndex(start)];
  }

  /**
     * Get player for the current user index
     * @returns {Object} The player
     */
  playerForCurrentIndex() {
    return this.players[this.cUserIndex];
  }

  /**
     * Draw cards from the pile and adds it to the players hand
     * @param   {Object} player The player
     * @param   {Number} amount Amount of cards to draw
     * @returns {Array}  An array of cards drawn
     */
  drawCards(player, amount) {
    if (amount > 0) {
      const cards = this.drawPile.splice(0, amount);
      player.addCards(cards);
      return cards;
    }

    return [];
  }

  /**
     * Explode a player
     * @param {Object} player The player
     */
  explodePlayer(player) {
    player.alive = false;

    //Add the hand to the discard pile
    for (const key in player.hand) {
      const card = player.hand[key];
      const set = new CardSet(player, [card]);
      this.discardPile.push(set);
    }
    player.hand = [];
  }

  /**
     * Reset the game
     */
  reset() {
    this.status = $.GAME.STATUS.WAITING;
    this.drawPile = [];
    this.discardPile = [];
    this.cUserIndex = 0;

    //Reset players
    for (const key in this.players) {
      const player = this.players[key];
      player.reset();
    }

    //Reset deck
    this.resetDeck();
    this.shuffleDeck();
  }

  /**
     * Reset the deck
     * Note: This doesn't add defuse and explode cards
     */
  resetDeck() {
    /*
        A deck consists of:
        4 Attack cards
        4 Skip cards
        4 Favor cards
        4 Shuffle cards
        5 Future cards
        4 x 5 Regular cards
        More than 5 players then deck size doubles
        */

    this.drawPile = [];

    const multiplier = this.players.length > 5 ? 2 : 1;

    //Generate cards
    for (let i = 0; i < 5 * multiplier; i++) {
      if (i < 4 * multiplier) {
        //Special
        this.drawPile.push(new Card(this.generateRandomID(), "Attack", $.CARD.ATTACK, 0));
        this.drawPile.push(new Card(this.generateRandomID(), "Skip", $.CARD.SKIP, 1));
        this.drawPile.push(new Card(this.generateRandomID(), "Favor", $.CARD.FAVOR, 2));
        this.drawPile.push(new Card(this.generateRandomID(), "Shuffle", $.CARD.SHUFFLE, 3));

        //Only add the reverse if we have more than 2 players since with 2 people order doesn't matter
        if (this.players.length > 2) {
          this.drawPile.push(new Card(this.generateRandomID(), "Reverse", $.CARD.REVERSE, 3));
        }

        //Regular
        this.drawPile.push(new Card(this.generateRandomID(), "Potato", $.CARD.REGULAR, 4));
        this.drawPile.push(new Card(this.generateRandomID(), "Cattermelon", $.CARD.REGULAR, 5));
        this.drawPile.push(new Card(this.generateRandomID(), "Rainbow", $.CARD.REGULAR, 6));
        this.drawPile.push(new Card(this.generateRandomID(), "Tacocat", $.CARD.REGULAR, 7));
        this.drawPile.push(new Card(this.generateRandomID(), "Beard", $.CARD.REGULAR, 8));
      }

      this.drawPile.push(new Card(this.generateRandomID(), "Future", $.CARD.FUTURE, 9));
      this.drawPile.push(new Card(this.generateRandomID(), "Nope", $.CARD.NOPE, 3));
    }
  }

  /**
     * Shuffle the deck of cards
     * @returns {Object} The shuffled deck
     */
  shuffleDeck() {
    for (let i = this.drawPile.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = this.drawPile[i];
      this.drawPile[i] = this.drawPile[j];
      this.drawPile[j] = temp;
    }
    return this.drawPile;
  }

  /**
     * Toggle the ready state of a user
     * @param   {Object} user The user
     * @returns {Boolean} Whether the user is ready
     */
  toggleReady(user) {
    const player = this.getPlayer(user);
    if (player) {
      player.ready = !player.ready;
      return player.ready;
    }

    return false;
  }

  /**
     * Check whether we can start a game
     * @returns {Boolean} Whether we can start a game
     */
  canStart() {
    if (this.players.length >= this.minPlayers) {
      //Make sure everyone is ready
      for (const key in this.players) {
        const player = this.players[key];
        if (!player.ready) return false;
      }

      return true;
    }

    return false;
  }

  /**
     * Get the discard pile of cards
     * @returns {Array} An array of cards in the discard pile
     */
  getDiscardPile() {
    let pile = [];

    //We have to iterate backwards from the pile so that the recently played cards are at the top
    for (let i = this.discardPile.length - 1; i >= 0; i--) {
      const cards = this.discardPile[i].cards;
      pile = pile.concat(cards);
    }

    return pile;
  }

  /**
     * Get the last played set in discard which isn't a nope
     * @returns {Object} The last set in discard
     */
  getLastDiscardSet() {
    let last = null;
    for (let i = this.discardPile.length - 1; i >= 0; i--) {
      const set = this.discardPile[i];
      const hasNope = set.cards.length == 1 && set.hasCardType($.CARD.NOPE);
      if (!hasNope) {
        last = set;
        break;
      }
    }
    return last;
  }

  /**
     * Update a discarded set if it is in the discard pile
     * @param {Object} set The card set
     */
  updateDiscardSet(set) {
    for (const key in this.discardPile) {
      if (this.discardPile[key].id === set.id) {
        this.discardPile[key].cards = set.cards;
        this.discardPile[key].nopeAmount = set.nopeAmount;
        this.discardPile[key].nopePlayed = set.nopePlayed;
        this.discardPile[key].effectPlayed = set.effectPlayed;
        break;
      }
    }
  }
}

export default Game;
