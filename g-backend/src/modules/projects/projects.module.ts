import {Module} from '@nestjs/common';
import {ProjectController} from './projects.controller';
import {ProjectService} from './projects.service';

@Module({
controllers:[ProjectController],
providers:[ProjectService],
exports:[ProjectService],
})

export class ProjectsModule{}

