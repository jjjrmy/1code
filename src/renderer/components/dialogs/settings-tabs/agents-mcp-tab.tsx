"use client"

import { useState, useEffect, useMemo } from "react"
import { ChevronRight, ChevronDown, Copy, FolderOpen } from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { useAtomValue } from "jotai"
import { sessionInfoAtom } from "../../../lib/atoms"
import { cn } from "../../../lib/utils"
import { OriginalMCPIcon } from "../../ui/icons"
import { Button } from "../../ui/button"
import { trpc } from "../../../lib/trpc"

// Hook to detect narrow screen
function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth <= 768)
    }

    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  return isNarrow
}

// Status indicator dot
function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "w-2 h-2 rounded-full flex-shrink-0",
        status === "connected" && "bg-green-500",
        status === "failed" && "bg-red-500",
        status === "needs-auth" && "bg-yellow-500",
        status === "pending" && "bg-muted-foreground/50 animate-pulse",
      )}
    />
  )
}

// Get status text
function getStatusText(status: string): string {
  switch (status) {
    case "connected":
      return "Connected"
    case "failed":
      return "Failed"
    case "needs-auth":
      return "Needs auth"
    case "pending":
      return "Not connected"
    default:
      return status
  }
}

// Extract project name from path
function getProjectName(projectPath: string): string {
  const parts = projectPath.split("/")
  return parts[parts.length - 1] || projectPath
}

interface ServerRowProps {
  server: {
    name: string
    status: string
    serverInfo?: { name: string; version: string }
    error?: string
    config?: Record<string, unknown>
  }
  tools: string[]
  isExpanded: boolean
  onToggle: () => void
}

function ServerRow({ server, tools, isExpanded, onToggle }: ServerRowProps) {
  const hasTools = tools.length > 0

  return (
    <div>
      <button
        onClick={hasTools ? onToggle : undefined}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
          hasTools && "hover:bg-muted/50 cursor-pointer",
          !hasTools && "cursor-default",
        )}
      >
        {/* Expand chevron */}
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform flex-shrink-0",
            isExpanded && "rotate-90",
            !hasTools && "opacity-0",
          )}
        />

        {/* Status dot */}
        <StatusDot status={server.status} />

        {/* Server info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground truncate">
              {server.name}
            </span>
            {server.serverInfo?.version && (
              <span className="text-xs text-muted-foreground">
                v{server.serverInfo.version}
              </span>
            )}
          </div>
          {server.error && (
            <p className="text-xs text-red-500/80 truncate mt-0.5">
              {server.error}
            </p>
          )}
        </div>

        {/* Status / tool count */}
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {server.status === "connected" && hasTools
            ? `${tools.length} tool${tools.length !== 1 ? "s" : ""}`
            : getStatusText(server.status)}
        </span>
      </button>

      {/* Auth instructions for needs-auth status */}
      {server.status === "needs-auth" && (
        <div className="flex items-center gap-2 pl-10 pr-3 pb-2">
          <Button
            variant="outline"
            className="h-5 text-[10px] px-2"
            onClick={() => {
              navigator.clipboard.writeText("claude /mcp")
              toast.success("Command copied! Run in terminal to authenticate.")
            }}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy auth command
          </Button>
          <span className="text-[10px] text-muted-foreground">
            Then restart chat
          </span>
        </div>
      )}

      {/* Expanded tools list */}
      <AnimatePresence>
        {isExpanded && hasTools && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="pl-10 pr-3 pb-2 space-y-0.5">
              {tools.map((tool) => (
                <div
                  key={tool}
                  className="text-xs text-muted-foreground font-mono py-0.5"
                >
                  {tool}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface ProjectSectionProps {
  projectPath: string
  mcpServers: Array<{
    name: string
    status: string
    serverInfo?: { name: string; version: string }
    error?: string
    config?: Record<string, unknown>
  }>
  tools: string[]
  isExpanded: boolean
  onToggle: () => void
  expandedServer: string | null
  onToggleServer: (serverName: string) => void
}

function ProjectSection({
  projectPath,
  mcpServers,
  tools,
  isExpanded,
  onToggle,
  expandedServer,
  onToggleServer,
}: ProjectSectionProps) {
  const projectName = getProjectName(projectPath)

  // Group tools by server
  const toolsByServer = mcpServers.reduce(
    (acc, server) => {
      const serverTools = tools
        .filter((tool) => tool.startsWith(`mcp__${server.name}__`))
        .map((tool) => tool.split("__").slice(2).join("__"))
      acc[server.name] = serverTools
      return acc
    },
    {} as Record<string, string[]>,
  )

  return (
    <div className="bg-background rounded-lg border border-border overflow-hidden">
      {/* Project header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1 truncate">
          {projectName}
        </span>
        <span className="text-xs text-muted-foreground">
          {mcpServers.length} server{mcpServers.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Servers list */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border divide-y divide-border/50">
              {mcpServers.map((server) => (
                <ServerRow
                  key={server.name}
                  server={server}
                  tools={toolsByServer[server.name] || []}
                  isExpanded={expandedServer === `${projectPath}:${server.name}`}
                  onToggle={() => onToggleServer(`${projectPath}:${server.name}`)}
                />
              ))}
            </div>
            {/* Project path hint */}
            <div className="px-3 py-2 bg-muted/30 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground font-mono truncate" title={projectPath}>
                {projectPath}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AgentsMcpTab() {
  const isNarrowScreen = useIsNarrowScreen()
  const [expandedProject, setExpandedProject] = useState<string | null>(null)
  const [expandedServer, setExpandedServer] = useState<string | null>(null)

  // Get live session info (for connected servers)
  const sessionInfo = useAtomValue(sessionInfoAtom)
  const liveTools = sessionInfo?.tools || []

  // Fetch all MCP configs from ~/.claude.json
  const { data: allMcpConfigs, isLoading } = trpc.claude.getAllMcpConfigs.useQuery()

  // Merge live session info with static config
  const projectsWithMcp = useMemo(() => {
    const projects = allMcpConfigs?.projects || []

    // If we have live session info, update the status for matching servers
    if (sessionInfo?.mcpServers?.length) {
      return projects.map(project => ({
        ...project,
        mcpServers: project.mcpServers.map(server => {
          const liveServer = sessionInfo.mcpServers.find(s => s.name === server.name)
          if (liveServer) {
            return {
              ...server,
              status: liveServer.status,
              serverInfo: liveServer.serverInfo,
              error: liveServer.error,
            }
          }
          return server
        })
      }))
    }

    return projects
  }, [allMcpConfigs, sessionInfo])

  // Auto-expand first project if only one exists
  useEffect(() => {
    if (projectsWithMcp.length === 1 && !expandedProject) {
      setExpandedProject(projectsWithMcp[0].projectPath)
    }
  }, [projectsWithMcp, expandedProject])

  const handleToggleProject = (projectPath: string) => {
    setExpandedProject(expandedProject === projectPath ? null : projectPath)
  }

  const handleToggleServer = (serverKey: string) => {
    setExpandedServer(expandedServer === serverKey ? null : serverKey)
  }

  const totalServers = projectsWithMcp.reduce((sum, p) => sum + p.mcpServers.length, 0)

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
      {/* Header */}
      {!isNarrowScreen && (
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h3 className="text-sm font-semibold text-foreground">MCP Servers</h3>
          <a
            href="https://docs.anthropic.com/en/docs/claude-code/mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            Documentation
          </a>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="bg-background rounded-lg border border-border p-6 text-center">
          <div className="animate-pulse">
            <div className="h-8 w-8 bg-muted rounded-full mx-auto mb-3" />
            <div className="h-4 w-32 bg-muted rounded mx-auto" />
          </div>
        </div>
      )}

      {/* Projects with MCP servers */}
      {!isLoading && projectsWithMcp.length > 0 && (
        <div className="space-y-3">
          {projectsWithMcp.map((project) => (
            <ProjectSection
              key={project.projectPath}
              projectPath={project.projectPath}
              mcpServers={project.mcpServers}
              tools={liveTools}
              isExpanded={expandedProject === project.projectPath}
              onToggle={() => handleToggleProject(project.projectPath)}
              expandedServer={expandedServer}
              onToggleServer={handleToggleServer}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && projectsWithMcp.length === 0 && (
        <div className="bg-background rounded-lg border border-border p-6 text-center">
          <OriginalMCPIcon className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-2">
            No MCP servers configured
          </p>
          <p className="text-xs text-muted-foreground">
            Add servers to{" "}
            <code className="px-1 py-0.5 bg-muted rounded">~/.claude.json</code>
          </p>
        </div>
      )}

      {/* Summary */}
      {!isLoading && projectsWithMcp.length > 0 && (
        <div className="text-xs text-muted-foreground text-center">
          {totalServers} server{totalServers !== 1 ? "s" : ""} across {projectsWithMcp.length} project{projectsWithMcp.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Info Section */}
      <div className="pt-4 border-t border-border space-y-3">
        <div>
          <h4 className="text-xs font-medium text-foreground mb-1.5">
            How to use MCP Tools
          </h4>
          <p className="text-xs text-muted-foreground">
            Mention a tool in chat with{" "}
            <code className="px-1 py-0.5 bg-muted rounded">@tool-name</code> or
            ask Claude to use it directly.
          </p>
        </div>
        <div>
          <h4 className="text-xs font-medium text-foreground mb-1.5">
            Configuring Servers
          </h4>
          <p className="text-xs text-muted-foreground">
            Add MCP server configuration to{" "}
            <code className="px-1 py-0.5 bg-muted rounded">~/.claude.json</code>{" "}
            under your project path.
          </p>
        </div>
      </div>
    </div>
  )
}
