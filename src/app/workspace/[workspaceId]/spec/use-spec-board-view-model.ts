"use client";

import { useCallback, useMemo, useState, type RefObject } from "react";
import {
  buildSpecBoardModel,
  normalizeSpecStatus,
  type FeatureSurfaceIndexResponse,
  type IssueRelations,
  type SpecIssue,
} from "./spec-board-model";
import type { Filters } from "./spec-page-helpers";

const EMPTY_FILTERS: Filters = {
  status: "",
  kind: "",
  severity: "",
  area: "",
};

const EMPTY_RELATIONS: IssueRelations = {
  outgoing: [],
  incoming: [],
  localOutgoing: [],
  familyId: "",
  familyIssues: [],
};

function filterIssues(issues: SpecIssue[], filters: Filters) {
  return issues.filter((issue) => {
    if (filters.status && normalizeSpecStatus(issue.status) !== filters.status) return false;
    if (filters.kind && issue.kind !== filters.kind) return false;
    if (filters.severity && issue.severity !== filters.severity) return false;
    if (filters.area && issue.area !== filters.area) return false;
    return true;
  });
}

export function useSpecBoardViewModel({
  allIssues,
  surfaceIndex,
  detailPaneRef,
  selectedIssueFilename,
  onSelectedIssueFilenameChange,
}: {
  allIssues: SpecIssue[];
  surfaceIndex: FeatureSurfaceIndexResponse;
  detailPaneRef: RefObject<HTMLDivElement | null>;
  selectedIssueFilename: string | null;
  onSelectedIssueFilenameChange: (filename: string | null) => void;
}) {
  const [selectedIssueFilenames, setSelectedIssueFilenames] = useState<Set<string>>(() => new Set());
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const boardModel = useMemo(() => buildSpecBoardModel(allIssues, surfaceIndex), [allIssues, surfaceIndex]);

  const selectIssueFilename = useCallback((filename: string | null) => {
    onSelectedIssueFilenameChange(filename);
  }, [onSelectedIssueFilenameChange]);

  const filteredIssues = useMemo(() => {
    return filterIssues(allIssues, filters);
  }, [allIssues, filters]);

  const selectedIssue = useMemo(() => {
    if (filteredIssues.length === 0) {
      return null;
    }

    if (selectedIssueFilename) {
      return filteredIssues.find((issue) => issue.filename === selectedIssueFilename) ?? filteredIssues[0] ?? null;
    }

    return filteredIssues[0] ?? null;
  }, [filteredIssues, selectedIssueFilename]);

  const filteredIssueSet = useMemo(() => new Set(filteredIssues.map((issue) => issue.filename)), [filteredIssues]);

  const selectedIssues = useMemo(() => {
    return allIssues.filter((issue) => selectedIssueFilenames.has(issue.filename));
  }, [allIssues, selectedIssueFilenames]);

  const visibleFamilies = useMemo(() => {
    return boardModel.families
      .map((family) => ({
        ...family,
        issues: family.issues.filter((issue) => filteredIssueSet.has(issue.filename)),
        unresolvedCount: family.issues.filter((issue) => filteredIssueSet.has(issue.filename))
          .filter((issue) => {
            const status = normalizeSpecStatus(issue.status);
            return status === "open" || status === "investigating";
          }).length,
        relationCount: family.issues
          .filter((issue) => filteredIssueSet.has(issue.filename))
          .reduce((total, issue) => {
            const relations = boardModel.relationsByFilename.get(issue.filename);
            return total + (relations?.localOutgoing.filter((linked) => filteredIssueSet.has(linked.filename)).length ?? 0);
          }, 0),
      }))
      .filter((family) => family.issues.length > 0);
  }, [boardModel.families, boardModel.relationsByFilename, filteredIssueSet]);

  const selectedIssueRelations = useMemo(() => {
    if (!selectedIssue) {
      return EMPTY_RELATIONS;
    }

    const relations = boardModel.relationsByFilename.get(selectedIssue.filename);
    if (!relations) {
      return {
        ...EMPTY_RELATIONS,
        familyId: selectedIssue.filename,
      };
    }

    return {
      ...relations,
      outgoing: relations.outgoing.filter((relation) => !relation.targetFilename || filteredIssueSet.has(relation.targetFilename)),
      incoming: relations.incoming.filter((issue) => filteredIssueSet.has(issue.filename)),
      localOutgoing: relations.localOutgoing.filter((issue) => filteredIssueSet.has(issue.filename)),
      familyIssues: relations.familyIssues.filter((issue) => filteredIssueSet.has(issue.filename)),
    };
  }, [boardModel.relationsByFilename, filteredIssueSet, selectedIssue]);

  const setFiltersAndSelection = useCallback((nextFilters: Filters) => {
    setFilters(nextFilters);
    const nextFilteredIssues = filterIssues(allIssues, nextFilters);
    const nextSelectedIssueFilename = nextFilteredIssues.length === 0
      ? null
      : selectedIssueFilename && nextFilteredIssues.some((issue) => issue.filename === selectedIssueFilename)
        ? selectedIssueFilename
        : (nextFilteredIssues[0] as SpecIssue).filename;
    selectIssueFilename(nextSelectedIssueFilename);
  }, [allIssues, selectIssueFilename, selectedIssueFilename]);

  const setSelectedIssue = useCallback((issue: SpecIssue | null) => {
    selectIssueFilename(issue?.filename ?? null);
  }, [selectIssueFilename]);

  const handleSelectLinkedIssue = useCallback((filename: string) => {
    const issue = boardModel.issueByFilename.get(filename);
    if (issue) {
      selectIssueFilename(issue.filename);
    }
  }, [boardModel.issueByFilename, selectIssueFilename]);

  const handleSelectIssue = useCallback((issue: SpecIssue) => {
    selectIssueFilename(issue.filename);
    window.requestAnimationFrame(() => {
      detailPaneRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    });
  }, [detailPaneRef, selectIssueFilename]);

  const handleToggleIssueSelection = useCallback((issue: SpecIssue) => {
    setSelectedIssueFilenames((current) => {
      const next = new Set(current);
      if (next.has(issue.filename)) {
        next.delete(issue.filename);
      } else {
        next.add(issue.filename);
      }
      return next;
    });
  }, []);

  const handleClearSelectedIssues = useCallback(() => {
    setSelectedIssueFilenames(new Set());
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  return {
    boardModel,
    filters,
    setFilters: setFiltersAndSelection,
    resetFilters,
    filteredIssues,
    selectedIssue,
    setSelectedIssue,
    selectedIssueFilenames,
    selectedIssues,
    visibleFamilies,
    selectedIssueRelations,
    handleSelectLinkedIssue,
    handleSelectIssue,
    handleToggleIssueSelection,
    handleClearSelectedIssues,
  };
}
