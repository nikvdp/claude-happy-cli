const crypto = require('crypto');
const fs = require('fs');

// Disable autoupdater (never works really)
process.env.DISABLE_AUTOUPDATER = '1';

// Helper to write JSON messages to fd 3
function writeMessage(message) {
    try {
        fs.writeSync(3, JSON.stringify(message) + '\n');
    } catch (err) {
        // fd 3 not available, ignore
    }
}

// Intercept crypto.randomUUID
const originalRandomUUID = crypto.randomUUID;
Object.defineProperty(global, 'crypto', {
    configurable: true,
    enumerable: true,
    get() {
        return {
            randomUUID: () => {
                const uuid = originalRandomUUID();
                writeMessage({ type: 'uuid', value: uuid });
                return uuid;
            }
        };
    }
});
Object.defineProperty(crypto, 'randomUUID', {
    configurable: true,
    enumerable: true,
    get() {
        return () => {
            const uuid = originalRandomUUID();
            writeMessage({ type: 'uuid', value: uuid });
            return uuid;
        }
    }
});

// Intercept fetch to track activity
const originalFetch = global.fetch;
let fetchCounter = 0;

global.fetch = function(...args) {
    const id = ++fetchCounter;
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const method = args[1]?.method || 'GET';
    
    // Parse URL for privacy
    let hostname = '';
    let path = '';
    try {
        const urlObj = new URL(url, 'http://localhost');
        hostname = urlObj.hostname;
        path = urlObj.pathname;
    } catch (e) {
        // If URL parsing fails, use defaults
        hostname = 'unknown';
        path = url;
    }
    
    // Send fetch start event
    writeMessage({
        type: 'fetch-start',
        id,
        hostname,
        path,
        method,
        timestamp: Date.now()
    });

    // Execute the original fetch immediately
    const fetchPromise = originalFetch(...args);
    
    // Attach handlers to send fetch end event
    const sendEnd = () => {
        writeMessage({
            type: 'fetch-end',
            id,
            timestamp: Date.now()
        });
    };
    
    // Send end event on both success and failure
    fetchPromise.then(sendEnd, sendEnd);
    
    // Return the original promise unchanged
    return fetchPromise;
};

// Preserve fetch properties
Object.defineProperty(global.fetch, 'name', { value: 'fetch' });
Object.defineProperty(global.fetch, 'length', { value: originalFetch.length });

// Check for custom command override
const customCommand = process.env.HAPPY_CLAUDE_COMMAND;

if (customCommand) {
    // Use custom command instead of importing Claude
    const { spawn } = require('child_process');
    const args = process.argv.slice(2); // Get all arguments passed to this script
    
    // Write to fd 3 that we're using custom command
    writeMessage({ type: 'custom-command', command: customCommand });
    
    // Spawn the custom command with all arguments
    const child = spawn(customCommand, args, {
        stdio: ['inherit', 'inherit', 'inherit', 'pipe'],
        env: process.env
    });
    
    // Pass through fd 3 if available
    if (child.stdio[3]) {
        child.stdio[3].on('data', (data) => {
            try {
                fs.writeSync(3, data);
            } catch (err) {
                // fd 3 not available, ignore
            }
        });
    }
    
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
    import('@anthropic-ai/claude-code/cli.js')
}