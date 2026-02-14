message DeployProjectSale {
    factory: Address;
    owner: Address;
    admin: Address;
    treasury: Address;
    tokenWallet: Address;
    softCap: Int as coins;
    hardCap: Int as coins;
    minContribution: Int as coins;
    maxContribution: Int as coins;
    liquidityBps: Int;
    treasuryBps: Int;
    tokenPerNano: Int;
    teamVestingEnabled: Bool;
    vestingCliffSeconds: Int;
    vestingDurationSeconds: Int;
    liquidityLockEnabled: Bool;
    liquidityLockUntil: Int;
}

message StartSale {}
message Buy {}
message Finalize {}
message Refund {}

message Bought {
    buyer: Address;
    amount: Int as coins;
    totalRaised: Int as coins;
}

message Finalized {
    totalRaised: Int as coins;
    liquidityAmount: Int as coins;
    treasuryAmount: Int as coins;
    state: Int;
    liquidityLockEnabled: Bool;
    liquidityLockUntil: Int;
    teamVestingEnabled: Bool;
    vestingCliffSeconds: Int;
    vestingDurationSeconds: Int;
}

message Refunded {
    buyer: Address;
    amount: Int as coins;
}

contract ProjectSale {
    factory: Address;
    owner: Address;
    admin: Address;
    treasury: Address;
    tokenWallet: Address;

    softCap: Int as coins;
    hardCap: Int as coins;
    minContribution: Int as coins;
    maxContribution: Int as coins;
    liquidityBps: Int;
    treasuryBps: Int;
    tokenPerNano: Int;

    teamVestingEnabled: Bool;
    vestingCliffSeconds: Int;
    vestingDurationSeconds: Int;
    liquidityLockEnabled: Bool;
    liquidityLockUntil: Int;

    totalRaised: Int as coins;
    finalizedAt: Int;
    status: Int;

    contributions: map<Address, Int>;

    const DRAFT: Int = 0;
    const LIVE: Int = 1;
    const SUCCESSFUL: Int = 2;
    const FAILED: Int = 3;
    const FINALIZED: Int = 4;

    init(data: DeployProjectSale) {
        require(data.hardCap > 0, "hard cap");
        require(data.softCap > 0 && data.softCap <= data.hardCap, "soft cap");
        require(data.minContribution > 0, "min");
        require(data.maxContribution >= data.minContribution, "max");
        require(data.liquidityBps + data.treasuryBps <= 10000, "bps");
        require(data.vestingCliffSeconds >= 0 && data.vestingDurationSeconds >= 0, "vesting");
        require(!data.liquidityLockEnabled || data.liquidityLockUntil > 0, "liq lock");

        self.factory = data.factory;
        self.owner = data.owner;
        self.admin = data.admin;
        self.treasury = data.treasury;
        self.tokenWallet = data.tokenWallet;
        self.softCap = data.softCap;
        self.hardCap = data.hardCap;
        self.minContribution = data.minContribution;
        self.maxContribution = data.maxContribution;
        self.liquidityBps = data.liquidityBps;
        self.treasuryBps = data.treasuryBps;
        self.tokenPerNano = data.tokenPerNano;
        self.teamVestingEnabled = data.teamVestingEnabled;
        self.vestingCliffSeconds = data.vestingCliffSeconds;
        self.vestingDurationSeconds = data.vestingDurationSeconds;
        self.liquidityLockEnabled = data.liquidityLockEnabled;
        self.liquidityLockUntil = data.liquidityLockUntil;

        self.totalRaised = 0;
        self.finalizedAt = 0;
        self.status = self.DRAFT;
    }

    receive(_: StartSale) {
        require(sender() == self.owner || sender() == self.factory || sender() == self.admin, "unauthorized");
        require(self.status == self.DRAFT, "state");
        self.status = self.LIVE;
    }

    receive(_: Buy) {
        require(self.status == self.LIVE, "not live");
        let value = context().value;
        require(value >= self.minContribution, "below min");

        let buyer = sender();
        let existing = self.contributions.get(buyer);
        let next = value;
        if (existing != null) {
            next = existing!! + value;
        }

        require(next <= self.maxContribution, "above max");
        require(self.totalRaised + value <= self.hardCap, "hard cap exceeded");

        self.contributions.set(buyer, next);
        self.totalRaised = self.totalRaised + value;

        if (self.totalRaised >= self.hardCap) {
            self.status = self.SUCCESSFUL;
        }

        emit(Bought {
            buyer: buyer,
            amount: value,
            totalRaised: self.totalRaised,
        }.toCell());
    }

    receive(_: Finalize) {
        require(sender() == self.admin || sender() == self.factory, "unauthorized");
        require(self.status != self.FINALIZED, "already finalized");

        if (self.status == self.LIVE) {
            if (self.totalRaised >= self.softCap) {
                self.status = self.SUCCESSFUL;
            } else {
                self.status = self.FAILED;
            }
        }

        require(self.status == self.SUCCESSFUL, "not successful");

        let liquidity = (self.totalRaised * self.liquidityBps) / 10000;
        let treasuryAmount = (self.totalRaised * self.treasuryBps) / 10000;

        if (liquidity > 0) {
            send(SendParameters {
                to: self.tokenWallet,
                value: liquidity,
                mode: SendIgnoreErrors,
                body: null,
            });
        }

        if (treasuryAmount > 0) {
            send(SendParameters {
                to: self.treasury,
                value: treasuryAmount,
                mode: SendIgnoreErrors,
                body: null,
            });
        }

        self.status = self.FINALIZED;
        self.finalizedAt = now();

        emit(Finalized {
            totalRaised: self.totalRaised,
            liquidityAmount: liquidity,
            treasuryAmount: treasuryAmount,
            state: self.status,
            liquidityLockEnabled: self.liquidityLockEnabled,
            liquidityLockUntil: self.liquidityLockUntil,
            teamVestingEnabled: self.teamVestingEnabled,
            vestingCliffSeconds: self.vestingCliffSeconds,
            vestingDurationSeconds: self.vestingDurationSeconds,
        }.toCell());
    }

    receive(_: Refund) {
        require(self.status == self.FAILED, "not failed");

        let buyer = sender();
        let amount = self.contributions.get(buyer);
        require(amount != null && amount!! > 0, "no contribution");

        self.contributions.set(buyer, 0);
        send(SendParameters {
            to: buyer,
            value: amount!!,
            mode: SendIgnoreErrors,
            body: null,
        });

        emit(Refunded {
            buyer: buyer,
            amount: amount!!,
        }.toCell());
    }

    get fun state(): Int {
        return self.status;
    }

    get fun raised(): Int {
        return self.totalRaised;
    }

    get fun contributionOf(addr: Address): Int {
        let amount = self.contributions.get(addr);
        if (amount == null) {
            return 0;
        }
        return amount!!;
    }

    get fun lockInfo(): Int {
        if (!self.liquidityLockEnabled) {
            return 0;
        }
        return self.liquidityLockUntil;
    }
}
