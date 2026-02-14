message Deploy {
  owner: Address;
}

contract SalePool {
  owner: Address;
  totalRaised: Int as coins;

  init(data: Deploy) {
    self.owner = data.owner;
    self.totalRaised = 0;
  }

  receive("deposit") {
    self.totalRaised = self.totalRaised + context().value;
  }

  get fun raised(): Int {
    return self.totalRaised;
  }
}
