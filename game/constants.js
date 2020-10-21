export default {
  LOBBY: {
    ROOM: "lobby",
    CONNECT: "connected",
    DISCONNECT: "disconnect"
  },

  GAME: {
    CREATE: "createGame",
    JOIN: "joinGame",
    LEAVE: "leaveGame",
    CREATED: "gameCreated",
    START: "startGame",
    STOP: "stopGame",
    STARTED: "gameStarted",
    STOPPED: "gameStopped",
    WIN: "winGame",
    UPDATE: "updateGame",
    DISCARDPILE: "discardPile",
    STATUS: {
      WAITING: "Waiting...",
      PLAYING: "Playing..."
    },
    PLAYER: {
      READY: "playerReady",
      CONNECT: "playerConnected",
      DISCONNECT: "playerDisconnected",
      ENDTURN: "playerEndTurn",
      TURN: {
        INVALID: "invalid",
        DEFUSED: "defused",
        EXPLODED: "exploded",
        SURVIVED: "survived",
        DISCONNECT: "disconnected"
      },
      HAND: "playerHand",
      DRAW: "playerDraw",
      PLAY: "playerPlayCard",
      DISCARDSELECT: "playerDiscardSelect",
      STEAL: "playerSteal",
      FAVOR: "playerFavor",
      FUTURE: "playerFuture",
      NOPE: "playerNope"
    },
    REMOVED: "gameRemoved"
  },

  USER: {
    CONNECT: "userConnected",
    DISCONNECT: "userDisconnected"
  },

  CARD: {
    ATTACK: "Attack",
    NOPE: "Nope",
    DEFUSE: "Defuse",
    EXPLODE: "Explode",
    SKIP: "Skip",
    FUTURE: "Future",
    FAVOR: "Favor",
    SHUFFLE: "Shuffle",
    REGULAR: "Regular"
    // REVERSE: "Reverse"
  },

  CARDSET: {
    STEAL: {
      BLIND: "blindSteal",
      NAMED: "namedSteal",
      DISCARD: "discardSteal",
      INVALID: "invalidSteal"
    }
  }
};
