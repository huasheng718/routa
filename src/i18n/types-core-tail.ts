export interface CoreTailTranslationDictionarySections {
  // Fitness / Fluency
  fitness: {
    panel: {
      genericReport: string;
      repoLabel: string;
      blockers: string;
      failed: string;
      fit: string;
      to: string;
      noData: string;
      refresh: string;
      genericProfile: string;
      orchestratorProfile: string;
      noReport: string;
      runFirstReport: string;
      rerunReport: string;
      runningReport: string;
      reportSourceLive: string;
      reportSourceSnapshot: string;
      reportSourceNone: string;
      noContext: string;
      noContextReport: string;
      notReady: string;
      capabilityMatrix: string;
      matrixNoPoint: string;
      statusIdle: string;
      statusLoading: string;
      statusReady: string;
      statusEmpty: string;
      statusError: string;
      fetchSnapshotFailed: string;
      analyzeFailedPrefix: string;
      noAnalyzeResponse: string;
      noWorkspaceSelected: string;
      noWorkspaceAction: string;
    };

    matrix: {
      collaboration: {
        title: string[];
        subtitle: string;
      };
      sdlc: {
        title: string[];
        subtitle: string;
      };
      harness: {
        title: string[];
        subtitle: string;
      };
      governance: {
        title: string[];
        subtitle: string;
      };
      context: {
        title: string[];
        subtitle: string;
      };
      awareness: {
        title: string[];
        subtitle: string;
      };
      assistedCoding: {
        title: string[];
        subtitle: string;
      };
      structuredAiCoding: {
        title: string[];
        subtitle: string;
      };
      agentCentric: {
        title: string[];
        subtitle: string;
      };
      agentFirst: {
        title: string[];
        subtitle: string;
      };
      noReport: string;
      noPointData: string;
    };

    overview: {
      noDimensionData: string;
      currentFindings: string;
      recommendedActions: string;
      withoutThis: string;
      noActiveBlockers: string;
      noActions: string;
      noProfileRecommendations: string;
      noComparisonHint: string;
      noDimensionChanges: string;
      noCriteriaChanges: string;
      dimensionChangesTitle: string;
      criteriaChangesTitle: string;
      levelLabel: string;
      scoreLabel: string;
      failsLabel: string;
      weightedChecks: string;
      examplesLabel: string;
      startFromLabel: string;
      noFailures: string;
      critical: string;
      fromLast: string;
      lastOverall: string;
      currentOverall: string;
      directionUp: string;
      directionDown: string;
      directionSame: string;
      cellsDivider: string;
      failingCriteriaLabel: string;
      criticalBlockersLabel: string;
      noReportTextLoading: string;
      noReportTextNotReady: string;
      noProfileErrorText: string;
      noReportForProfileText: string;
      notReached: string;
    };

    measures: {
      governance: {
        title: string;
        subtitle: string;
        body: string;
        without: string;
        examples: string[];
      };
      harness: {
        title: string;
        subtitle: string;
        body: string;
        without: string;
        examples: string[];
      };
      context: {
        title: string;
        subtitle: string;
        body: string;
        without: string;
        examples: string[];
      };
      sdlc: {
        title: string;
        subtitle: string;
        body: string;
        without: string;
        examples: string[];
      };
      collaboration: {
        title: string;
        subtitle: string;
        body: string;
        without: string;
        examples: string[];
      };
    };

    status: {
      noData: string;
      notReady: string;
      critical: string;
      priorityFix: string;
    };

    scoring: {
      title: string;
      sourceFromReport: string;
      sourceFromRun: string;
      sourceOffline: string;
      noReadinessInfo: string;
      levelUnlockPrefix: string;
      levelUnlockSuffix: string;
      noLevelUnlock: string;
      compareEnabled: string;
      compareDisabled: string;
      deterministicMode: string;
      nonDeterministicMode: string;
      fromUnknown: string;
    };

    action: {
      running: string;
      noAction: string;
      unknownProfile: string;
      noSnapshots: string;
      analyzeFailed: string;
    };

    levels: {
      awareness: string;
      assistedCoding: string;
      structuredCoding: string;
      agentCentric: string;
      agentFirst: string;
      waitingReport: string;
      current: string;
      target: string;
      cleared: string;
      locked: string;
    };

    dashboard: {
      noReport: string;
      overallReadiness: string;
      nextUnlock: string;
      hardBlockers: string;
      passRate: string;
      currentLevelHint: string;
      targetLevelHint: string;
      hardBlockersHint: string;
      passRateHint: string;
      targetVsCurrent: string;
      targetVsCurrentHint: string;
      currentLegend: string;
      targetLegend: string;
      unlockRunway: string;
      unlockRunwayHint: string;
      currentLevelBar: string;
      nextLevelBar: string;
      noNextLevel: string;
      gateStatus: string;
      gateStatusHint: string;
      gatePass: string;
      gateWarn: string;
      gateFail: string;
      noBlockers: string;
      heatmap: string;
      heatmapHint: string;
      fromLastRun: string;
      changedDimensions: string;
      changedCriteria: string;
      noHistory: string;
      notAvailable: string;
    };
  };
}
