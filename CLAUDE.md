# Claude Code Integration Guide

This document provides guidelines and tips for working with Claude Code in the Cryptrade project.

## Sound Notifications

Claude Code can automatically play sound notifications for various events during development. This feature uses the macOS `afplay` command to provide audio feedback for important milestones, task completions, or errors.

### How It Works

Sound notifications are triggered automatically when:
- **Task Completion**: A pleasant chime plays when a task or build process completes successfully
- **Error Detection**: A distinct alert sound plays when errors occur during execution
- **Important Milestones**: Special sounds mark significant achievements like passing all tests or completing deployments
- **Long-Running Operations**: A notification sound alerts you when time-consuming operations finish

### Available Sounds

The following system sounds are commonly used:
- `/System/Library/Sounds/Glass.aiff` - Success/completion sound
- `/System/Library/Sounds/Basso.aiff` - Error/warning sound  
- `/System/Library/Sounds/Hero.aiff` - Major achievement sound
- `/System/Library/Sounds/Ping.aiff` - Notification/alert sound

### Examples

When Claude Code completes a task, you might hear:
```bash
# Task completed successfully
afplay /System/Library/Sounds/Glass.aiff

# Error encountered
afplay /System/Library/Sounds/Basso.aiff

# All tests passed
afplay /System/Library/Sounds/Hero.aiff
```

### Benefits

- **Passive Monitoring**: Continue working on other tasks while Claude Code runs in the background
- **Instant Feedback**: Know immediately when something requires your attention
- **Enhanced Productivity**: No need to constantly check terminal output
- **Customizable**: Different sounds for different types of events help you understand what happened without looking

### Note

Sound notifications are only available on macOS systems with the `afplay` command. The feature is automatically disabled on other operating systems to ensure compatibility.