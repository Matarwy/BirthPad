import "./ProjectSale.tact";

message DeployFactory {
    owner: Address;
    admin: Address;
}

message CreateProject {
    projectOwner: Address;
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

message ProjectCreated {
    projectId: Int;
    sale: Address;
    owner: Address;
}

contract LaunchFactory {
    owner: Address;
    admin: Address;
    nextProjectId: Int;
    projects: map<Int, Address>;

    init(data: DeployFactory) {
        self.owner = data.owner;
        self.admin = data.admin;
        self.nextProjectId = 1;
    }

    receive(msg: CreateProject) {
        require(sender() == self.owner || sender() == self.admin, "unauthorized");

        let init = initOf ProjectSale(DeployProjectSale {
            factory: myAddress(),
            owner: msg.projectOwner,
            admin: self.admin,
            treasury: msg.treasury,
            tokenWallet: msg.tokenWallet,
            softCap: msg.softCap,
            hardCap: msg.hardCap,
            minContribution: msg.minContribution,
            maxContribution: msg.maxContribution,
            liquidityBps: msg.liquidityBps,
            treasuryBps: msg.treasuryBps,
            tokenPerNano: msg.tokenPerNano,
            teamVestingEnabled: msg.teamVestingEnabled,
            vestingCliffSeconds: msg.vestingCliffSeconds,
            vestingDurationSeconds: msg.vestingDurationSeconds,
            liquidityLockEnabled: msg.liquidityLockEnabled,
            liquidityLockUntil: msg.liquidityLockUntil,
        });

        let sale = contractAddress(init);

        send(SendParameters {
            to: sale,
            value: ton("0.2"),
            mode: SendIgnoreErrors,
            body: StartSale {}.toCell(),
            code: init.code,
            data: init.data,
        });

        let id = self.nextProjectId;
        self.projects.set(id, sale);
        self.nextProjectId = id + 1;

        emit(ProjectCreated {
            projectId: id,
            sale: sale,
            owner: msg.projectOwner,
        }.toCell());
    }

    get fun projectAddress(id: Int): Address {
        let addr = self.projects.get(id);
        require(addr != null, "missing");
        return addr!!;
    }
}
