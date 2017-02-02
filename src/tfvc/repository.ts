/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
"use strict";

import { TeamServerContext} from "../contexts/servercontext";
import { Logger } from "../helpers/logger";
import { ITfvcCommand, IExecutionResult } from "./interfaces";
import { Tfvc } from "./tfvc";
import { IArgumentProvider, IWorkspace, IPendingChange } from "./interfaces";
import { GetVersion } from "./commands/getversion";
import { FindWorkspace } from "./commands/findworkspace";
import { Status } from "./commands/status";

var _ = require("underscore");

/**
 * The Repository class allows you to perform TFVC commands on the workspace represented 
 * by the repositoryRootFolder.
 */
export class Repository {
    private _serverContext: TeamServerContext;
    private _tfvc: Tfvc;
    private _repositoryRootFolder: string;
    private _env: any;
    private _versionAlreadyChecked = false;

    public constructor(serverContext: TeamServerContext, tfvc: Tfvc, repositoryRootFolder: string, env: any = {}) {
        Logger.LogDebug(`TFVC Repository created with repositoryRootFolder='${repositoryRootFolder}'`);
        this._serverContext = serverContext;
        this._tfvc = tfvc;
        this._repositoryRootFolder = repositoryRootFolder;
        this._env = env;

        // Add the environment variables that we need to make sure the CLC runs as fast as possible and
        // provides English strings back to us to parse.
        this._env.TF_NOTELEMETRY = "TRUE";
        this._env.TF_ADDITIONAL_JAVA_ARGS = "-Duser.country=US -Duser.language=en";
    }

    public get Tfvc(): Tfvc {
        return this._tfvc;
    }

    public get Path(): string {
        return this._repositoryRootFolder;
    }

    public async FindWorkspace(localPath: string): Promise<IWorkspace> {
        Logger.LogDebug(`TFVC Repository.FindWorkspace with localPath='${localPath}'`);
        return this.RunCommand<IWorkspace>(
            new FindWorkspace(localPath));
    }

    public async GetStatus(ignoreFiles?: boolean): Promise<IPendingChange[]> {
        Logger.LogDebug(`TFVC Repository.GetStatus`);
        return this.RunCommand<IPendingChange[]>(
            new Status(this._serverContext, ignoreFiles === undefined ? true : ignoreFiles));
    }

    public async CheckVersion(): Promise<string> {
        if (!this._versionAlreadyChecked) {
            Logger.LogDebug(`TFVC Repository.CheckVersion`);
            // Set the versionAlreadyChecked flag first in case one of the other lines throws
            this._versionAlreadyChecked = true;
            const version: string = await this.RunCommand<string>(new GetVersion());
            this._tfvc.CheckVersion(version);
            return version;
        }

        return undefined;
    }

    public async RunCommand<T>(cmd: ITfvcCommand<T>): Promise<T> {
        const result = await this.exec(cmd.GetArguments(), cmd.GetOptions());
        return await cmd.ParseOutput(result);
    }

    private async exec(args: IArgumentProvider, options: any = {}): Promise<IExecutionResult> {
        options.env = _.assign({}, options.env || {});
        options.env = _.assign(options.env, this._env);
        return await this.Tfvc.Exec(this._repositoryRootFolder, args, options);
    }
}
