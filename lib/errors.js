/** Error type whose message is safe to show to the user in a command result. */
export class WorktreeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'WorktreeError'
  }
}
