import {Module} from '@nestjs/common';
import {SandBoxService} from './sandbox.service';
import {SandboxTestController} from './sandbox-test.controller';

@Module({
    controllers:[SandboxTestController],
    providers:[SandBoxService],
    exports:[SandBoxService],
})

export class SandBoxModule{}

