import "./ProjectSale.tact";

message DeployFactory {
    owner: Address;
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
}

message ProjectCreated {
    projectId: Int;
    sale: Address;
    owner: Address;
}

contract LaunchFactory {
    owner: Address;
    nextProjectId: Int;
    projects: map<Int, Address>;

    init(data: DeployFactory) {
        self.owner = data.owner;
        self.nextProjectId = 1;
    }

    receive(msg: CreateProject) {
        require(sender() == self.owner, "unauthorized");

        let init = initOf ProjectSale(DeployProjectSale {
            factory: myAddress(),
            owner: msg.projectOwner,
            treasury: msg.treasury,
            tokenWallet: msg.tokenWallet,
            softCap: msg.softCap,
            hardCap: msg.hardCap,
            minContribution: msg.minContribution,
            maxContribution: msg.maxContribution,
            liquidityBps: msg.liquidityBps,
            treasuryBps: msg.treasuryBps,
            tokenPerNano: msg.tokenPerNano,
        });

        let sale = contractAddress(init);

        send(SendParameters {
            to: sale,
            value: ton("0.2"),
            mode: SendIgnoreErrors,
            body: StartSale {},
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
