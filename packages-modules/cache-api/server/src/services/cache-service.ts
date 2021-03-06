import * as _ from 'lodash';
import * as Logger from 'bunyan';

import { Types } from '../constants';
import { ICacheService, ICacheEngine, ICacheOptions, ICacheSetOptions } from '../interfaces';
import { create } from 'domain';
import { Redis } from '../engines/ioredis-engine';
import { logger as cdmLogger } from '@cdm-logger/server';
import { config } from '../config';
import * as url from 'url';

export class Cache implements ICacheService {
    private static DEFAULT_SCOPE = 'cde_cache';
    private static instance: Cache;

    private logger: Logger;
    private engine: ICacheEngine;

    constructor(
        engine: ICacheEngine,
        logger?: Logger,
    ) {
        this.engine = engine;
        if (logger) {
            this.logger = logger.child(this.constructor.name);
        } else {
            this.logger = cdmLogger.child(this.constructor.name);
        }
    }

    public static get Instance() {
        if (this.instance) {
            return this.instance;
        }
        const { port, hostname } = url.parse(config.REDIS_URL) as { port: any, hostname: string };
        let options;
        let client;
        if (config.REDIS_SENTINEL_ENABLED) {
            options = {
                sentinels: [{ host: hostname, port }],
                name: config.REDIS_SENTINEL_NAME,
            };
            client = new Redis(options);
        } else if (config.REDIS_CLUSTER_ENABLED) {
            options = {};
            client = new Redis(options, true, config.REDIS_CLUSTER_URL);
        } else {
            options = { host: hostname, port };
            client = new Redis(options);
        }
        this.instance = new this(client);
        return this.instance;
    }

    private key(key: string, scope?: string) {
        return `${scope || Cache.DEFAULT_SCOPE}.${key}`;
    }

    private isExpired(createdAt: number, maxAge: number) {
        const now = parseInt(`${Date.now() / 1000}`, null);
        return now - createdAt > maxAge;
    }

    private getOptions(opts: ICacheOptions) {
        return Object.assign(this.defaults, opts || {});
    }

    get defaults() {
        return {
            scope: Cache.DEFAULT_SCOPE,
            maxAge: config.REDIS_CACHE_MAX_AGE_in_sec,
            createdAt: parseInt(`${Date.now() / 1000}`, null),
        };
    }

    public async set(key: string, payload: any, options?: ICacheSetOptions) {
        const opts = this.getOptions(options);
        const cache = Object.assign({}, { payload }, opts);

        const path = this.key(key, opts.scope);
        const result = this.engine.set(path, cache);

        return payload;
    }

    public async get(key: string, options?: ICacheOptions) {
        const opts = this.getOptions(options);
        const path = this.key(key, opts.scope);
        const cache = await this.engine.get(path);

        if (cache == null) {
            return null;
        }

        if (this.isExpired(cache.createdAt, cache.maxAge)) {
            this.engine.drop(path);
            return null;
        } else {
            return opts.parse
                ? cache.payload
                : cache.payload; // not really doing anything here
        }
    }

    public async drop(key, options?: ICacheOptions) {
        const opts = this.getOptions(options);
        const path = this.key(key, opts.scope);

        const ok = this.engine.drop(path);
        return true;
    }

    public async invalidate(keys, options?: ICacheOptions) {
        if (keys.length <= 0) {
            return this.engine.invalidate();
        } else {
            const opts = this.getOptions(options);
            const paths = keys.map(key => this.key(key, opts.scope));

            return this.engine.invalidate(paths);
        }
    }
}
