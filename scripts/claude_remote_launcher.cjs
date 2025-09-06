// Check for custom command override
const customCommand = process.env.HAPPY_CLAUDE_COMMAND;

if (customCommand) {
    // Use custom command instead of importing Claude
    const { spawn } = require('child_process');
    const args = process.argv.slice(2); // Get all arguments passed to this script
    
    console.error(`[claude_remote_launcher] Using custom Claude command: ${customCommand}`);
    
    // Spawn the custom command with all arguments
    const child = spawn(customCommand, args, {
        stdio: 'inherit',
        env: process.env
    });
    
    // Pass through exit code
    child.on('exit', (code) => {
        process.exit(code || 0);
    });
    
    child.on('error', (err) => {
        console.error(`Failed to start custom command: ${err.message}`);
        process.exit(1);
    });
} else {
    // Default behavior - import Claude directly
    // Intercept setTimeout for the Claude Code SDK
    const originalSetTimeout = global.setTimeout;

    global.setTimeout = function(callback, delay, ...args) {
        // Just wrap and call the original setTimeout
        return originalSetTimeout(callback, delay, ...args);
    };

    // Preserve setTimeout properties
    Object.defineProperty(global.setTimeout, 'name', { value: 'setTimeout' });
    Object.defineProperty(global.setTimeout, 'length', { value: originalSetTimeout.length });

    import('@anthropic-ai/claude-code/cli.js')
}