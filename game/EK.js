import User from "./user";
import Game from "./game";
import $ from "./constants";

/**
 * Main game manager
 * @param {Object} io Socket.io object
 */
class EK {
  constructor(io) {
    //List of all the current users
    this.connectedUsers = {};

    //List of all the current games
    this.gameList = {};

    //List of pending card sets to be processed
    this.pendingSets = {};
  }

  /**
     * Check if a user with the given name is connected
     * @param   {String}  nickname The name
     * @returns {Boolean} Given name is connected
     */
  isUserWithNameConnected(nickname) {
    let connected = false;

    for (const key in this.connectedUsers) {
      const user = this.connectedUsers[key];
      if (user.name === nickname) {
        connected = true;
        break;
      }
    }

    return connected;
  }

  /**
     * Add a user to the connected users
     * @param {Object} user The user
     */
  addUser(user) {
    if (!(user.id in this.connectedUsers)) {
      this.connectedUsers[user.id] = user;
    }
  }

  /**
     * Remove a user from connected users
     * @param {Object} user The user
     */
  removeUser(user) {
    if (user.id in this.connectedUsers) {
      delete this.connectedUsers[user.id];
    }
  }

  /**
     * Add a game to the game list
     * @param {Object} game The game
     */
  addGame(game) {
    if (!(game.id in this.gameList)) {
      this.gameList[game.id] = game;
    }
  }

  /**
     * Remove a game from the game list
     * @param {Object} game The game
     */
  removeGame(game) {
    if (game.id in this.gameList) {
      delete this.gameList[game.id];
    }
  }

  /**
     * Add a pending set to the list
     * @param {Object} set    The card set
     * @param {Object} data   The data associated with the set
     * @param {Object} socket The socket
     */
  addPendingSet(set, data, socket) {
    this.pendingSets[set.id] = {
      set,
      data,
      socket
    };
  }

  /**
     * Remove a set from the pending set list
     * @param {Object} set A card set
     */
  removePendingSet(set) {
    if (set.id in this.pendingSets) {
      delete this.pendingSets[set.id];
    }
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
}

export default EK;
