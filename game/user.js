class User {
  constructor(id, nickname) {
    //User id
    this.id = id;

    //User name
    this.name = nickname;

    //Current room user is in
    this.currentRoom = null;
  }
}

export default User;
