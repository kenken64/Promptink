import { log } from "../utils"

/**
 * Summarize a GitHub repository using Repomix
 * Uses the --remote flag to process a repository directly from GitHub
 */
export async function summarizeGitHubRepo(url: string): Promise<string> {
  log("INFO", "Summarizing GitHub repo with Repomix", { url })

  try {
    const result = await Bun.$`npx repomix --remote ${url} --style markdown`.text()

    log("INFO", "Repomix summarization complete", {
      outputLength: result.length
    })

    return result
  } catch (error) {
    log("ERROR", "Repomix summarization failed", { url, error: String(error) })
    throw new Error(`Failed to summarize repository: ${String(error)}`)
  }
}
