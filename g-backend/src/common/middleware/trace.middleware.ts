import {Injectable, NestMiddleware} from '@nestjs/common';
import {Request, Response, NextFunction} from 'express';
import {randomUUID} from 'crypto';

declare module 'express-serve-static-core'{
    interface Request{
        traceId?: string;
    }
}

@Injectable()
export class TraceMiddleware implements NestMiddleware{
    use(request:Request, response:Response, next:NextFunction){
        const headerName = (process.env.TRACE_HEADER || 'x-trace-id').toLowerCase();

        //read traceId from the header if it is present
        const incoming = request.headers[headerName] as string | undefined;
        //create the traceId if missing 
        const traceId = incoming &&  incoming.trim().length > 0 ? incoming : randomUUID();

        //attch the req  for later usage

        request.traceId = traceId;

        //now we also need to include it in the reponse

        response.setHeader(headerName,traceId);

        next();


    
        
    }
}
