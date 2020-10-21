import User from "./user";

import Game from "./game";
import $ from "./constants";
import CardSet from "./cardset";

/*
TODO: Add reverse card
*/

/**
 * This class handles all the game logic
 * @param {Object} io The socket io
 * @param {Object} EK The game instance
 */
export default (io, EK) => {
  //************ Socket routes ************//

  io.on("connection", socket => {
    /**
     * Disconnect from the server
     * @param {Object} data The data
     */
    socket.on("disconnect", data => {
      if (socket.id in EK.connectedUsers) {
        //Get the user id and fetch their details
        const user = EK.connectedUsers[socket.id];
        if (!user) return;

        //Tell everyone the user disconnected
        io.emit($.USER.DISCONNECT, {
          user
        });

        //Notify room
        if (user.currentRoom != $.LOBBY.ROOM) {
          const game = EK.gameList[user.currentRoom];
          if (game) {
            io.in(user.currentRoom).emit($.GAME.PLAYER.DISCONNECT, {
              player: game.getPlayer(user),
              game: game.sanitize()
            });
            removeUserFromGame(user, game, io, socket);
          }
        }

        //Leave all rooms
        socket.leave(user.currentRoom);

        //Remove the user from connected users
        EK.removeUser(user);
      }
    });

    /**
     * Connect to lobby
     * Responds with connected users and game list.
     *
     * Request Data: {
     *   nickname: "User nickname"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.LOBBY.CONNECT, data => {
      const valid = data && data.hasOwnProperty("nickname");

      //Check for valid nickname
      if (!valid) {
        socket.emit($.LOBBY.CONNECT, {
          error: "Invalid name"
        });
        return;
      }

      const nickname = data.nickname;

      //Check if a user with name is connected
      if (EK.isUserWithNameConnected(nickname)) {
        socket.emit($.LOBBY.CONNECT, {
          error: "User is already connected with that name!"
        });
        return;
      }

      //Check if current user is already connected
      if (socket.id in EK.connectedUsers) {
        socket.emit($.LOBBY.CONNECT, {
          error: "User is already connected with a different name!"
        });
        return;
      }

      //Check if nickname is between 2 and 12 characters
      if (nickname.length < 2 || nickname.length > 12) {
        socket.emit($.LOBBY.CONNECT, {
          error: "Name has to be between 2 and 12 characters!"
        });
        return;
      }

      //Join the lobby
      socket.join($.LOBBY.ROOM);

      //Create user
      const user = new User(socket.id, data.nickname);
      console.log(`User Connecting: ${user.id} ${user.name}`);

      //Tell everyone user has connected
      user.currentRoom = $.LOBBY.ROOM;
      socket.broadcast.emit($.USER.CONNECT, {
        user
      });

      //Get the game list data
      const gameList = [];
      for (const key in EK.gameList) {
        const game = EK.gameList[key];
        gameList.push(game.sanitize());
      }

      //Add the user and send them the data
      EK.addUser(user);
      socket.emit($.LOBBY.CONNECT, {
        success: "Successfully connected",
        user,
        connectedUsers: EK.connectedUsers,
        gameList
      });
    });

    /**
     * Create a game.
     * Responds with game data if created else an error.
     *
     * Request Data: {
     *   title: "Game title"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.CREATE, data => {
      const title = data.title;
      if (!title || title.length <= 0 || title.length >= 30) {
        socket.emit($.GAME.CREATE, {
          error: "Bad Title"
        });
        return;
      }

      //Make sure title is unique
      for (const key in EK.gameList) {
        var game = EK.gameList[key];
        if (game.title === title) {
          socket.emit($.GAME.CREATE, {
            error: "Game with title already exists!"
          });
          return;
        }
      }

      //Make sure user is in lobby
      const user = EK.connectedUsers[socket.id];
      if (user.currentRoom != $.LOBBY.ROOM) {
        socket.emit($.GAME.CREATE, {
          error: "User is in another lobby"
        });
        return;
      }

      //Generate a unique id
      let gameId = null;
      while (!gameId || gameId in EK.gameList) {
        gameId = EK.generateRandomID();
      }

      //Create the game
      var game = new Game(gameId, title);

      //Add the user
      if (!addUserToGame(user, game, socket)) {
        socket.emit($.GAME.CREATE, {
          error: "Failed to create game"
        });
        return;
      }

      console.log(`Game created: ${gameId} ${title}`);

      EK.addGame(game);

      //Tell everyone a game was created
      io.emit($.GAME.CREATED, {
        game: game.sanitize()
      });

      //Return the game data to the user
      socket.emit($.GAME.CREATE, {
        success: "Game created",
        game: game.sanitize()
      });
    });

    /**
     * Join a game on the server.
     * Responds with players and game data.
     *
     * Request Data: {
     *   gameId: "Game Id"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.JOIN, ({ gameId }) => {
      //Get the game and check if it exists
      const game = EK.gameList[gameId];
      const user = EK.connectedUsers[socket.id];

      if (!game) {
        socket.emit($.GAME.JOIN, {
          error: "Invalid game"
        });
        return;
      }

      //Add player
      if (!addUserToGame(user, game, socket)) {
        socket.emit($.GAME.JOIN, {
          error: "Failed to join game"
        });
        return;
      }

      const currentPlayer = game.getPlayer(user);

      //Notify the players in the game that user has joined
      socket.broadcast.in(game.id).emit($.GAME.PLAYER.CONNECT, {
        game: game.sanitize(),
        player: currentPlayer
      });

      //Send data to player
      socket.emit($.GAME.JOIN, {
        success: "Successfully joined game!",
        game: game.sanitize()
      });

      //Send data to everyone
      io.emit($.GAME.UPDATE, {
        game: game.sanitize()
      });
    });

    /**
     * Leave a game.
     * If no one is left in game then it is destroyed
     *
     * Request Data: {
     *   gameId: "game id"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.LEAVE, data => {
      //Get the game and check if it exists
      const game = EK.gameList[data.gameId];
      const user = EK.connectedUsers[socket.id];
      if (!game) {
        socket.emit($.GAME.LEAVE, {
          error: "Invalid game"
        });
        return;
      }

      //Check if we have to stop the game (happens when players < min players)
      if (game.players.length < game.minPlayers) {
        stopGame(io, data);
      }

      //Get the player
      const player = game.getPlayer(user);

      //Remove the user from the game
      removeUserFromGame(user, game, io, socket);

      //Notify players that user has left
      io.in(game.id).emit($.GAME.PLAYER.DISCONNECT, {
        player,
        game: game.sanitize()
      });

      socket.emit($.GAME.LEAVE, {
        success: "Left game"
      });

      io.emit($.GAME.UPDATE, {
        game: game.sanitize()
      });
    });

    /**
     * Start a game.
     * All players must be ready and the person initiating must be the host
     *
     * Request Data: {
     *   gameId: "game id"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.START, ({ gameId }) => {
      const game = EK.gameList[gameId];

      if (game && game.status == $.GAME.STATUS.WAITING) {
        const user = EK.connectedUsers[socket.id];
        if (user === game.gameHost()) {
          if (game.start()) {
            //Tell everyone game has started, from there they individually send a request for their hand
            io.in(game.id).emit($.GAME.START, {
              game: game.sanitize()
            });

            //Message lobby
            io.emit($.GAME.STARTED, {
              game: game.sanitize()
            });

            console.log(`Started game: ${game.id}`);
          } else {
            socket.emit($.GAME.START, {
              error: "Could not start game"
            });
          }
        }
      }
    });

    /**
     * Stop a game.
     *
     * Request Data: {
     *   gameId: "game id"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.STOP, data => {
      stopGame(io, data);
    });

    /**
     * Ready up for the next game.
     *
     * Request Data: {
     *   gameId: "game id"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.PLAYER.READY, ({ gameId }) => {
      const game = EK.gameList[gameId];

      //We can only ready up if the game state is waiting
      if (game && game.status == $.GAME.STATUS.WAITING) {
        const user = EK.connectedUsers[socket.id];
        const ready = game.toggleReady(user);

        //Tell everyone in room the ready state of the player
        io.in(game.id).emit($.GAME.PLAYER.READY, {
          player: game.getPlayer(user)
        });
      }
    });

    /**
     * Get the current users hand
     *
     * Request Data: {
     *   gameId: "game id"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.PLAYER.HAND, ({ gameId }) => {
      const game = EK.gameList[gameId];

      //We can only get hand if game is playing
      if (game && game.status == $.GAME.STATUS.PLAYING) {
        const user = EK.connectedUsers[socket.id];
        const player = game.getPlayer(user);

        //Return the player hand
        if (player) {
          socket.emit($.GAME.PLAYER.HAND, {
            player: game.getPlayer(user),
            hand: game.getPlayer(user).hand
          });
        }
      }
    });

    /**
     * Get the game discard pile
     *
     * Request Data: {
     *   gameId: "game id"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.DISCARDPILE, ({ gameId }) => {
      const game = EK.gameList[gameId];

      //We can only get discard pile if game is playing
      if (game && game.status == $.GAME.STATUS.PLAYING) {
        //Make sure user is in the game
        const user = EK.connectedUsers[socket.id];
        if (!game.getPlayer(user)) return;

        socket.emit($.GAME.DISCARDPILE, {
          cards: game.getDiscardPile()
        });
      }
    });

    /**
     * End current players turn
     * @param {Object} data The data
     */
    socket.on($.GAME.PLAYER.ENDTURN, ({ gameId }) => {
      //Get the game and check if it exists
      const game = EK.gameList[gameId];

      if (game && game.status == $.GAME.STATUS.PLAYING) {
        const user = EK.connectedUsers[socket.id];

        //Only end turn if we are the current player and the last played set effect was fulfilled
        //E.g for favors you need to wait for the other player before you can end your turn
        if (game.cUserIndex == game.playerIndexForUser(user)) {
          let state = $.GAME.PLAYER.TURN.SURVIVED;
          const player = game.getPlayer(user);

          //Check if effects have been played
          if (!effectsPlayed(game, player)) {
            socket.emit($.GAME.PLAYER.ENDTURN, {
              error: "Waiting for card effect to take place"
            });
            return;
          }

          if (player.drawAmount >= 1) {
            //Make player draw a card and if it is an explode then remove a defuse
            //If player has no defuse then player is out
            const drawn = game.drawCards(player, 1);
            socket.emit($.GAME.PLAYER.DRAW, {
              game: game.sanitize(),
              cards: drawn,
              hand: player.hand
            });

            //Tell other players that player drew a card
            socket.broadcast.in(game.id).emit($.GAME.PLAYER.DRAW, {
              game: game.sanitize(),
              player
            });
          }

          //Use while loop incase player picks up 2 explodes
          while (player.hasCardType($.CARD.EXPLODE)) {
            if (player.hasCardType($.CARD.DEFUSE)) {
              //Remove deufse and add it to the discard pile
              const defuse = player.removeCardType($.CARD.DEFUSE);
              const set = new CardSet(player, [defuse]);
              set.effectPlayed = true;
              game.discardPile.push(set);

              //Add the bomb back into the draw pile at a random position
              const explode = player.removeCardType($.CARD.EXPLODE);
              const index = Math.floor(Math.random() * game.drawPile.length);
              game.drawPile.splice(index, 0, explode);

              state = $.GAME.PLAYER.TURN.DEFUSED;
            } else {
              //Player exploded
              state = $.GAME.PLAYER.TURN.EXPLODED;
              game.explodePlayer(player);
            }
          }

          //Check for a winner
          if (!checkGameWin(game)) {
            //Check if player defused or exploded, if so then they have to end their turn no matter the amount of draws remaining
            if (!(state === $.GAME.PLAYER.TURN.SURVIVED)) player.drawAmount = 1;

            player.drawAmount -= 1;

            if (player.drawAmount < 1) {
              //Next players turn
              const nextAlive = game.getNextAliveIndex(game.cUserIndex);
              if (nextAlive != game.cUserIndex) {
                game.cUserIndex = nextAlive;
              }

              //Reset player draw amount (dead = 0, alive = 1)
              player.drawAmount = Number(player.alive);

              //Send state information back
              io.in(game.id).emit($.GAME.PLAYER.ENDTURN, {
                player,
                state,
                game: game.sanitize() //Send updated game info back
              });
            }
          }
        }
      }
    });

    /**
     * Play cards.
     *
     * Request Data: {
     *   gameId: "gameId",
     *   cards: [] //An array of card ids to play
     *   to: "User id" //Optional: The user to do the action against
     *   cardType: "Card type" //Optional: Type of card to steal
     *   cardId: "Card id to steal" //Optional: Card id to steal
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.PLAYER.PLAY, data => {
      const game = EK.gameList[data.gameId];
      if (game && game.status == $.GAME.STATUS.PLAYING) {
        //Check if it is the current users turn
        const user = EK.connectedUsers[socket.id];
        if (game.cUserIndex == game.playerIndexForUser(user) && data.cards.length > 0) {
          const player = game.getPlayer(user);

          //Check if player is alive
          if (!player.alive) {
            socket.emit($.GAME.PLAYER.PLAY, {
              error: "Cannot play card"
            });
            return;
          }

          //Check if effects have been played
          if (!effectsPlayed(game, player)) {
            socket.emit($.GAME.PLAYER.PLAY, {
              error: "Waiting for card effect to take place"
            });
            return;
          }

          //Check if the player has the cards
          if (!player.hasCardsWithId(data.cards)) {
            socket.emit($.GAME.PLAYER.PLAY, {
              error: "Player does not have cards"
            });
            return;
          }

          //Get cards from the players hand
          const cards = player.getCardsWithId(data.cards);

          //Disallow playing the defuse, regular or nope alone
          if (cards.length == 1) {
            if (
              cards[0].type === $.CARD.DEFUSE ||
              cards[0].type === $.CARD.REGULAR ||
              cards[0].type === $.CARD.NOPE
            ) {
              socket.emit($.GAME.PLAYER.PLAY, {
                error: "Cannot play defuse, regular or nope cards alone!"
              });
              return;
            }

            if (cards[0].type === $.CARD.EXPLODE) {
              socket.emit($.GAME.PLAYER.PLAY, {
                error: "Cannot play explode! How the heck did you even get it?"
              });
              return;
            }
          }

          //Add the cards to a set
          const playedSet = new CardSet(player, cards);

          //Whether the other specified player exists
          const otherPlayerExists = data => {
            const user = EK.connectedUsers[data.to];
            const player = game.getPlayer(user);

            //Make sure we have a person 'to' do action on and that we're not doing the action to ourself and that the player is alive
            return (
              data.hasOwnProperty("to") &&
              user &&
              EK.connectedUsers[socket.id] != user &&
              player &&
              player.alive
            );
          };

          //Check for combos
          if (playedSet.cards.length > 1) {
            const steal = playedSet.canSteal();
            switch (steal) {
              case $.CARDSET.STEAL.BLIND:
                //Only steal if we have someone to steal from
                if (!otherPlayerExists(data)) {
                  socket.emit($.GAME.PLAYER.PLAY, {
                    error: "Invalid user selected"
                  });
                  return;
                }

                var other = EK.connectedUsers[data.to];
                var otherPlayer = game.getPlayer(other);

                //Check if the other player has any cards
                if (otherPlayer && otherPlayer.hand.length < 1) {
                  socket.emit($.GAME.PLAYER.PLAY, {
                    error: "User has no cards in their hand!"
                  });
                  return;
                }

                break;
              case $.CARDSET.STEAL.NAMED:
                //Only steal if we have someone to steal from
                if (!otherPlayerExists(data)) {
                  socket.emit($.GAME.PLAYER.PLAY, {
                    error: "Invalid user selected"
                  });
                  return;
                }

                //Make sure we have a specified card selected
                if (!data.hasOwnProperty("cardType")) {
                  socket.emit($.GAME.PLAYER.PLAY, {
                    error: "Invalid card type selected"
                  });
                  return;
                }
                break;

              case $.CARDSET.STEAL.DISCARD:
                //Make sure we have a specified card selected
                if (!data.hasOwnProperty("cardId")) {
                  socket.emit($.GAME.PLAYER.PLAY, {
                    error: "Invalid card type selected"
                  });
                  return;
                }
                break;

              default:
                //Make sure to let the player know to only play 1 card at a time if not playing a combo
                socket.emit($.GAME.PLAYER.PLAY, {
                  error: "Invalid combo"
                });
                return;
            }
          } else {
            const card = playedSet.cards[0];
            switch (card.type) {
              case $.CARD.FAVOR:
                //Only favor if we have someone to get a favor from
                if (!otherPlayerExists(data)) {
                  socket.emit($.GAME.PLAYER.PLAY, {
                    error: "Invalid user selected"
                  });
                  return;
                }

                var other = EK.connectedUsers[data.to];
                var otherPlayer = game.getPlayer(other);

                //Check if the other player has any cards
                if (otherPlayer && otherPlayer.hand.length < 1) {
                  socket.emit($.GAME.PLAYER.PLAY, {
                    error: "User has no cards in their hand!"
                  });
                  return;
                }

                break;
            }
          }

          //Remove the cards played and put them in the discard pile
          player.removeCards(cards);
          game.discardPile.push(playedSet);

          //Don't send the set details if players have no nopes
          const replySet = playersHaveNope(game) ? playedSet : null;

          //Notify players that cards were played
          io.in(game.id).emit($.GAME.PLAYER.PLAY, {
            game: game.sanitize(),
            player,
            cards,
            set: replySet,
            to: data.to
          });

          //Wait for nope requests
          playedSet.nopePlayed = true;
          checkNopes(playedSet, data, socket, game);
        }
      }
    }); //End $.GAME.PLAYER.PLAY

    /**
     * Nope a played set.
     *
     * Request Data: {
     *   gameId: "gameId",
     *   setId: "Set id to nope"
     * }
     *
     * @param {Object} data The data
     */
    socket.on($.GAME.PLAYER.NOPE, ({ gameId, setId }) => {
      const game = EK.gameList[gameId];
      const user = EK.connectedUsers[socket.id];
      if (game && game.status == $.GAME.STATUS.PLAYING) {
        const pendingSet = EK.pendingSets[setId];

        if (pendingSet && !pendingSet.set.nopePlayed) {
          const player = game.getPlayer(user);

          //Check if player has a nope
          if (player && player.hasCardType($.CARD.NOPE)) {
            //Play the nope and set the pending set data
            const card = player.removeCardType($.CARD.NOPE);
            const cardSet = new CardSet(player, [card]);
            cardSet.effectPlayed = true;
            game.discardPile.push(cardSet);

            //Set the nope played and amount
            EK.pendingSets[setId].set.nopePlayed = true;
            EK.pendingSets[setId].set.nopeAmount += 1;

            //Notify players that a nope was played
            io.in(game.id).emit($.GAME.PLAYER.NOPE, {
              player,
              cards: [card],
              game: game.sanitize(),
              set: EK.pendingSets[setId].set
            });
          } else {
            socket.emit($.GAME.PLAYER.NOPE, {
              error: "Could not get player or you don't have a nope card!"
            });
          }
        } else {
          socket.emit($.GAME.PLAYER.NOPE, {
            error: "Could not play nope at this time!"
          });
        }
      }
    });

    /**
     * Give a favor to a player
     *
     * Request Data: {
     *   gameId: "game id",
     *   to: "The user id to do favor to",
     *   card: "The card id"
     * }
     * @param {Object} data The data
     */
    socket.on($.GAME.PLAYER.FAVOR, data => {
      //Get the game and check if it exists
      const game = EK.gameList[data.gameId];

      if (game && game.status == $.GAME.STATUS.PLAYING) {
        const user = EK.connectedUsers[socket.id];
        const player = game.getPlayer(user);

        //Check if we have right player
        if (
          !data.hasOwnProperty("to") ||
          !EK.connectedUsers[data.to] ||
          !game.getPlayer(EK.connectedUsers[data.to])
        ) {
          socket.emit($.GAME.PLAYER.FAVOR, {
            error: "Invalid player"
          });
          return;
        }

        //Check if current user has card
        if (!data.hasOwnProperty("card") || !game.getPlayer(user).hasCardWithId(data.card)) {
          socket.emit($.GAME.PLAYER.FAVOR, {
            error: "Invalid card"
          });
          return;
        }

        //Check if the other person is currently the one doing their turn
        const other = EK.connectedUsers[data.to];
        const otherPlayer = game.getPlayer(other);

        if (otherPlayer === game.playerForCurrentIndex()) {
          //Check if the favor is still possible
          if (!effectsPlayed(game, otherPlayer)) {
            //Make sure the last set is still not pending
            const lastSet = game.getLastDiscardSet();
            if (!EK.pendingSets[lastSet.id]) {
              //Remove the card from player and give it to other player
              const card = player.removeCardWithId(data.card);
              otherPlayer.addCard(card);

              //Set the effect play
              game.getLastDiscardSet().effectPlayed = true;

              //Notify players of the favor
              io.in(game.id).emit($.GAME.PLAYER.FAVOR, {
                success: true,
                to: other,
                from: user,
                card
              });
              return;
            }
          }
        }

        //If we hit here then favor did not go through
        socket.emit($.GAME.PLAYER.FAVOR, {
          error: "Something went wrong"
        });
      }
    });
  });

  //************ Socket methods ************//

  /**
   * Process the actions of a pending set
   * @param   {Object}   pendingSet The pending set object. Not to be confused with card set.
   */
  const processPendingSet = pendingSet => {
    //Emit most errors out from this method because the errors should have been handled by $.GAME.PLAYER.PLAY socket handler

    //Get data needed
    const data = pendingSet.data;
    const playedSet = pendingSet.set;
    const socket = pendingSet.socket;
    const game = EK.gameList[pendingSet.data.gameId];
    const user = EK.connectedUsers[socket.id];
    const player = game.getPlayer(user);

    //Keep track if we have to force user to end turn
    let endTurn = false;

    //Whether the other specified player exists
    const otherPlayerExists = data => {
      const user = EK.connectedUsers[data.to];
      const player = game.getPlayer(user);

      //Make sure we have a person 'to' do action on and that we're not doing the action to ourself and that the player is alive
      return (
        data.hasOwnProperty("to") &&
        user &&
        EK.connectedUsers[socket.id] != user &&
        player &&
        player.alive
      );
    };

    //Set the effect to played by default
    playedSet.effectPlayed = true;

    //Check for combos
    if (playedSet.cards.length > 1) {
      const steal = playedSet.canSteal();
      switch (steal) {
        case $.CARDSET.STEAL.BLIND:
          if (otherPlayerExists(data)) {
            var other = EK.connectedUsers[data.to];
            var otherPlayer = game.getPlayer(other);

            if (otherPlayer.hand.length > 0) {
              //Remove a random card from the other players hand and add it to the current player
              var card = otherPlayer.getRandomCard();
              otherPlayer.removeCard(card);
              player.addCard(card);

              //Tell players that a steal occurred
              io.in(game.id).emit($.GAME.PLAYER.STEAL, {
                to: other.id,
                from: socket.id,
                card,
                type: steal
              });
            } else {
              socket.emit($.GAME.PLAYER.PLAY, {
                error: "User has no cards in their hand!"
              });
            }
          }
          break;
        case $.CARDSET.STEAL.NAMED:
          if (otherPlayerExists(data)) {
            var other = EK.connectedUsers[data.to];
            var otherPlayer = game.getPlayer(other);
            const type = data.cardType;

            //Remove the specified card from the other players hand and add it to the current player
            var card = otherPlayer.removeCardType(type);
            if (card) {
              player.addCard(card);

              //Tell players that a steal occurred
              io.in(game.id).emit($.GAME.PLAYER.STEAL, {
                success: true,
                to: other.id,
                from: socket.id,
                cardType: type,
                card: card.id,
                type: steal
              });
            } else {
              //Tell players that stealing was unsuccessful
              io.in(game.id).emit($.GAME.PLAYER.STEAL, {
                success: false,
                to: other.id,
                from: socket.id,
                cardType: type,
                type: steal
              });
            }
          }
          break;

        case $.CARDSET.STEAL.DISCARD:
          //Get the data needed
          const id = data.cardId;
          var card = null;
          let currentKey = null;

          //Go through the discard pile and remove given card and add it to user
          for (const key in game.discardPile) {
            const set = game.discardPile[key];
            if (set.hasCardWithId(id)) {
              //Get the card and remove the set if it's empty
              card = set.removeCardWithId(id);
              if (card) {
                currentKey = key;
                break;
              }
            }
          }

          //If card existed then give it to the user
          if (card) {
            player.addCard(card);

            //Notify players of the steal
            io.in(game.id).emit($.GAME.PLAYER.STEAL, {
              success: true,
              card,
              type: steal,
              from: socket.id
            });
          } else {
            //Tell them of the failure
            io.in(game.id).emit($.GAME.PLAYER.STEAL, {
              success: false,
              type: steal,
              from: socket.id
            });
          }

          //Remove the set from the discard pile if it's empty
          const currentSet = game.discardPile[currentKey];
          if (currentSet && currentSet.isEmpty()) {
            game.discardPile.splice(currentKey, 1);
          }

          break;

        default:
          //Make sure to let the player know to only play 1 card at a time if not playing a combo
          socket.emit($.GAME.PLAYER.PLAY, {
            error: "Invalid combo"
          });
      }
    } else {
      var card = playedSet.cards[0];
      switch (card.type) {
        case $.CARD.ATTACK:
          //Attack the next person that is alive
          const nextPlayer = game.getNextAlive(game.cUserIndex);

          //Set the draw amount to 0 so that we just end our turn without drawing anything
          player.drawAmount = 0;
          nextPlayer.drawAmount = 2;

          //Force player to end turn
          endTurn = true;

          break;

        case $.CARD.FAVOR:
          if (otherPlayerExists(data)) {
            var other = EK.connectedUsers[data.to];
            var otherPlayer = game.getPlayer(other);

            //Set the favor to false
            playedSet.effectPlayed = false;

            //Check if the other player has any cards
            //Tough luck if a player gets this D:
            //This can happen if the favor goes through even with nopes and the person has no card
            if (otherPlayer && otherPlayer.hand.length < 1) {
              socket.emit($.GAME.PLAYER.PLAY, {
                error: "User has no cards in their hand!"
              });
              playedSet.effectPlayed = true;
            } else {
              //Ask other player for favor
              io.in(game.id).emit($.GAME.PLAYER.FAVOR, {
                force: true,
                from: user,
                to: other
              });
            }
          }

          break;
        case $.CARD.FUTURE:
          //Get the first 3 cards on the top of the draw pile
          const futureCards = [];
          for (let i = 0; i < 3; i++) {
            if (game.drawPile[i]) {
              futureCards.push(game.drawPile[i]);
            }
          }

          //Send the cards to the player
          socket.emit($.GAME.PLAYER.FUTURE, {
            cards: futureCards
          });

          break;

        case $.CARD.SKIP:
          //Remove 1 draw amount as 1 skip = 1 draw amount
          player.drawAmount -= 1;

          //Force player to end turn
          if (player.drawAmount < 1) {
            endTurn = true;
          }

          break;

        case $.CARD.SHUFFLE:
          //Shuffle the deck
          game.shuffleDeck();
          break;
        case $.CARD.REVERSE:
          //Switch direction
          game.direction *= -1;
          break;
      }
    }

    //Update the discard pile
    game.updateDiscardSet(playedSet);

    //Notify players again that cards were played
    /*io.in(game.id).emit($.GAME.PLAYER.PLAY, {
            player: player,
            cards: playedSet.cards
        });*/

    //Send user info about ending turn
    if (endTurn) {
      //Tell player to force end turn
      socket.emit($.GAME.PLAYER.ENDTURN, {
        force: true,
        player
      });
    }
  };

  /**
     * Check if any nopes were played.
     * If a nope was played then extend timer by game nope time.
     * If no nopes were played then process the played set
     * @param {Object} playedSet The played set
     * @param {Object} data The data
     * @param {Object} socket The socket
     * @param {Object} game The game
     */
  var checkNopes = (playedSet, data, socket, game) => {
    //Check if the set is pending
    let pending = EK.pendingSets[playedSet.id];
    if (!pending) {
      EK.addPendingSet(playedSet, data, socket);
      pending = EK.pendingSets[playedSet.id];
    }

    //Set the sets nopePlayed to false as no other player can nope
    if (!playersHaveNope(game)) {
      pending.set.nopePlayed = false;
    }

    if (pending.set.nopePlayed) {
      //Poll the set
      EK.pendingSets[playedSet.id].set.nopePlayed = false;
      setTimeout(() => {
        checkNopes(pending.set, data, socket, game);
      }, game.nopeTime);
    } else {
      //If there is an even amount of nopes played then we can process
      if (pending.set.nopeAmount % 2 == 0) {
        processPendingSet(pending);
      } else {
        pending.set.effectPlayed = true;

        //Update the discard pile
        game.updateDiscardSet(pending.set);
      }

      //Notify players that set cannot be noped any more
      if (pending.data && pending.data.gameId) {
        io.in(pending.data.gameId).emit($.GAME.PLAYER.NOPE, {
          set: pending.set,
          canNope: false
        });
      }

      //Remove the set from pending
      EK.removePendingSet(pending.set);
    }
  };

  /**
     * Check if players in a game have nopes
     * @param   {Object} game The game
     * @returns {Boolean}  Whether any player has a nope
     */
  var playersHaveNope = ({ players }) => {
    //Check if any players have a nope
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (player.hasCardType($.CARD.NOPE)) {
        return true;
      }
    }
    return false;
  };

  /**
     * Whether the last card sets effects were played
     * @param   {Object}   game   The game
     * @param   {Object} player The player
     * @returns {Boolean}  True if the last sets effects were played else false
     */
  var effectsPlayed = (game, player) => {
    //Check for last set effect played
    if (game.discardPile.length > 0) {
      const lastSet = game.getLastDiscardSet();
      if (lastSet.owner == player) {
        return lastSet.effectPlayed;
      }
    }

    return true;
  };

  /**
     * Add user to a game
     * @param   {Object}  user The user
     * @param   {Object}  game The game
     * @param   {Object}  socket  The socket
     * @returns {Boolean} Whether adding user to game was successful
     */
  var addUserToGame = (user, game, socket) => {
    //Add the user to the game
    if (!game.addPlayer(user)) return false;

    //Leave old room
    if (user && user.currentRoom) {
      socket.leave(user.currentRoom);
    }

    //Join the game room
    user.currentRoom = game.id;
    socket.join(game.id);

    return true;
  };

  /**
     * Remove user from a game
     * @param {Object}   user     The user
     * @param {Object}   game     The game
     * @param {Object}   io       The socket io
     * @param {Object}   socket   The socket
     */
  var removeUserFromGame = (user, game, io, socket) => {
    const player = game.getPlayer(user);
    const currentPlayer = game.playerForCurrentIndex();

    if (player) {
      //Remove the user from the game
      game.removePlayer(user);

      //If game was in progress then put players cards in the discard pile
      if (game.status === $.GAME.STATUS.PLAYING) {
        for (const key in player.hand) {
          const card = player.hand[key];
          const set = new CardSet(player, [card]);
          game.discardPile.push(set);
        }

        player.hand = [];

        //Check for a winner
        if (!checkGameWin(game)) {
          //Check if the player is the current one drawing, if so determine winner or force next turn
          if (player === currentPlayer) {
            //TODO: When last player leaves the next alive player is not set
            //Next players turn
            const nextAlive = game.getNextAliveIndex(game.cUserIndex - 1);
            game.cUserIndex = nextAlive;

            //Send state information back
            io.in(game.id).emit($.GAME.PLAYER.ENDTURN, {
              player,
              state: $.GAME.PLAYER.TURN.DISCONNECT,
              game: game.sanitize()
            });
          }
        }
      }
    }

    //Leave old room
    socket.leave(user.currentRoom);

    //Join the lobby
    user.currentRoom = $.LOBBY.ROOM;
    socket.join($.LOBBY.ROOM);

    //Check if we have to remove game
    if (game.players.length == 0) {
      io.emit($.GAME.REMOVED, {
        id: game.id
      });
      EK.removeGame(game);
      console.log(`Removed game: ${game.id}`);
      return;
    }
  };

  /**
     * Stop the current game
     * @param {Object} io   The io
     * @param {Object} data The data
     */
  var stopGame = (io, { gameId }) => {
    const game = EK.gameList[gameId];

    if (game && game.stop()) {
      //Tell players
      io.in(game.id).emit($.GAME.STOP, {
        game: game.sanitize()
      });

      //Tell lobby
      io.emit($.GAME.STOPPED, {
        game: game.sanitize()
      });

      console.log(`Stopped game: ${game.id}`);
    }
  };

  /**
     * Check if there is a winner in a game.
     * If there is a winner then a message is emitted and the game is stopped.
     * @param   {Object}  game The game
     * @returns {Boolean} Whether the game has a winner
     */
  var checkGameWin = game => {
    if (game.playerAliveCount() < 2) {
      let winner = null;
      for (const key in game.players) {
        const player = game.players[key];
        if (player.alive) winner = player;
      }

      //Tell everyone user won
      if (winner) {
        io.in(game.id).emit($.GAME.WIN, {
          user: winner.user
        });
      }

      //Stop the game
      stopGame(io, { gameId: game.id });

      return true;
    }

    return false;
  };
};
