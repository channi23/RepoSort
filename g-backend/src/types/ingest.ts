export interface IngestMetadata {
    repoUrl: string;
    isMonorepo: boolean;
    packageManager: string;
    runtime: string;
    testFramework: string;
    detectedStack: string[];
}
