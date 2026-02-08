import {Module} from '@nestjs/common';
import {SandboxService} from './sandbox.service';
import {SandboxTestController} from './sandbox-test.controller';

@Module({
    controllers:[SandboxTestController],
    providers:[SandboxService],
    exports:[SandboxService],
})

export class SandboxModule{}

