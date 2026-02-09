export interface BaseJobData {
    traceId: string;
    projectId: string;
}

export interface IngestJobData extends BaseJobData {
    repoUrl: string;
}

export interface AnalyzeJobData extends BaseJobData {
    repoSnapshotId: string;
}

export interface BuildGraphJobData extends BaseJobData {
    repoSnapshotId: string;
}
