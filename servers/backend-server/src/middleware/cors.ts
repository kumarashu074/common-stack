import * as cors from 'cors';
import * as express from 'express';
import { SETTINGS } from '../config';
import { logger } from '@common-stack/utils';

const CLIENT_URL = SETTINGS.CLIENT_URL;
const BACKEND_URL = SETTINGS.BACKEND_URL;

const corsWhitelist = [
    BACKEND_URL,
    CLIENT_URL,
    SETTINGS.GRAPHQL_URL,
];
logger.info('Cors whitelist: %j', corsWhitelist);
const corsOptions = {
    origin: (origin, callback) => {
        if (corsWhitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // TODO: only throw when in debug mode
            logger.error('url (%s) is not in the whitelist', origin);
            // callback(new Error('Not allowed by CORS'))
            logger.warn('allowing all origins temporarily, you need to disable it.');
            callback(null, true);
        }
    },
    credentails: false,
};

export const corsMiddleware = cors(corsOptions);
