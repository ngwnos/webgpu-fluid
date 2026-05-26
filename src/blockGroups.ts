import {
  DEFAULT_GRID_BLOCK_GROUPS,
  type GridBlockGroup,
  type GridBlockGroupCollection,
  type GridBlockType,
} from './gridLayout'

export type BlockGroupsState = GridBlockGroupCollection & {
  readonly activeGroupId: string
}

type BlockGroupsListener = (state: BlockGroupsState) => void

const GROUP_COLOR_PALETTE = ['#ff2dd4', '#ffcc33', '#22d3ee', '#a78bfa', '#fb7185', '#84cc16']

let nextGroupNumber = DEFAULT_GRID_BLOCK_GROUPS.length + 1
let currentState: BlockGroupsState = {
  groups: DEFAULT_GRID_BLOCK_GROUPS.map((group) => ({ ...group })),
  version: 0,
  activeGroupId: DEFAULT_GRID_BLOCK_GROUPS[0].id,
}
const listeners = new Set<BlockGroupsListener>()

export function getBlockGroupsState(): BlockGroupsState {
  return cloneState(currentState)
}

export function getBlockGroupCollection(): GridBlockGroupCollection {
  return {
    groups: currentState.groups.map((group) => ({ ...group })),
    version: currentState.version,
  }
}

export function getActiveBlockGroupId(): string {
  return currentState.activeGroupId
}

export function setActiveBlockGroupId(groupId: string): void {
  if (groupId === currentState.activeGroupId || !currentState.groups.some((group) => group.id === groupId)) return

  currentState = { ...currentState, activeGroupId: groupId }
  emit()
}

export function addBlockGroup(): GridBlockGroup {
  const groupNumber = nextGroupNumber
  nextGroupNumber += 1
  const group = {
    id: `group-${Date.now().toString(36)}-${groupNumber}`,
    name: `Group ${groupNumber}`,
    blockType: 'solid' as const,
    color: GROUP_COLOR_PALETTE[(groupNumber - 1) % GROUP_COLOR_PALETTE.length],
  }

  currentState = {
    groups: [...currentState.groups, group],
    version: currentState.version + 1,
    activeGroupId: group.id,
  }
  emit()
  return group
}

export function updateBlockGroup(
  groupId: string,
  patch: Partial<Pick<GridBlockGroup, 'name' | 'color'>> & { readonly blockType?: GridBlockType },
): void {
  let changed = false
  const groups = currentState.groups.map((group) => {
    if (group.id !== groupId) return group

    const nextGroup = {
      ...group,
      ...patch,
      name: patch.name ?? group.name,
    }
    changed =
      changed ||
      nextGroup.name !== group.name ||
      nextGroup.color !== group.color ||
      nextGroup.blockType !== group.blockType
    return nextGroup
  })

  if (!changed) return

  currentState = {
    ...currentState,
    groups,
    version: currentState.version + 1,
  }
  emit()
}

export function deleteBlockGroup(groupId: string): void {
  if (currentState.groups.length <= 1) return

  const groups = currentState.groups.filter((group) => group.id !== groupId)
  if (groups.length === currentState.groups.length) return

  currentState = {
    groups,
    version: currentState.version + 1,
    activeGroupId:
      currentState.activeGroupId === groupId ? (groups[0]?.id ?? currentState.activeGroupId) : currentState.activeGroupId,
  }
  emit()
}

export function subscribeBlockGroups(listener: BlockGroupsListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(): void {
  const snapshot = cloneState(currentState)
  for (const listener of listeners) {
    listener(snapshot)
  }
}

function cloneState(state: BlockGroupsState): BlockGroupsState {
  return {
    groups: state.groups.map((group) => ({ ...group })),
    version: state.version,
    activeGroupId: state.activeGroupId,
  }
}
