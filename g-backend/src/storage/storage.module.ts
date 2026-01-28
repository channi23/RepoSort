import {Module} from '@nestjs/common';
import {StorageService} from './storage.service';
import {StorageTestController} from './storage-test.controller';

@Module({
    controllers:[StorageTestController],
    providers:[StorageService],
    exports:[StorageService],
})

export class StorageModule{}


