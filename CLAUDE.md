# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Development
- `npm run build` - Build the project using Grunt
- `npm run build-dev` - Build for development (includes source maps)
- `npm run dev` - Run development build with watching
- `npm start` - Start Node-RED runtime
- `npm test` or `grunt` - Run all tests (unit tests and node tests)

### Testing
- `grunt simplemocha:all` - Run all unit and node tests
- `grunt simplemocha:core` - Run only core unit tests (excludes nodes)
- `grunt simplemocha:nodes` - Run only node tests
- `grunt nyc:all` - Run tests with coverage (all)
- `grunt nyc:core` - Run tests with coverage (core only)
- `grunt webdriver:all` - Run editor UI tests using WebDriver

### Linting and Code Quality
- `grunt jshint` - Run JSHint linting
- Code follows 4-space indentation (no tabs)
- Opening braces on same line as control structures
- All files must include Apache license header

## Architecture Overview

Node-RED is organized as a monorepo with multiple scoped packages under `@node-red`:

### Core Packages (in packages/node_modules/@node-red/)
- **`@node-red/runtime`** - Core runtime engine that executes flows
- **`@node-red/editor-api`** - Express application serving the editor and Admin HTTP API
- **`@node-red/editor-client`** - Client-side editor application resources
- **`@node-red/nodes`** - Default set of core nodes (common, function, network, parsers, sequence, storage)
- **`@node-red/registry`** - Internal node registry for managing node types
- **`@node-red/util`** - Common utilities shared across runtime and editor

### Key Directories
- `/packages/node_modules/@node-red/` - Core Node-RED modules
- `/test/unit/` - Unit tests for core components
- `/test/nodes/` - Tests for node implementations
- `/test/editor/` - WebDriver-based UI tests for the editor
- `/scripts/` - Build and maintenance scripts

## Build System

The project uses **Grunt** as the primary build system:

- **Gruntfile.js** - Main build configuration
- Supports concurrent building and watching
- Includes SASS compilation for editor styles
- Handles JSDoc generation for API documentation
- Manages packaging and compression tasks

## Testing Strategy

- **Mocha** for unit testing with `should` assertions
- **NYC** for test coverage reporting
- **WebDriver** for browser-based editor testing
- **node-red-node-test-helper** for testing custom nodes
- Test files follow `*_spec.js` naming convention
- All `.js` files should have corresponding `_spec.js` test files

## Development Workflow

1. **Setup**: Run `npm install` to install dependencies
2. **Build**: Run `npm run build` to compile the project
3. **Development**: Use `npm run dev` for active development with file watching
4. **Testing**: Run `npm test` before committing changes
5. **Editor Testing**: Use WebDriver tests for UI functionality verification

## Code Conventions

- Target Node.js version: >=18.5
- Use 4-space indentation consistently
- Follow JSHint rules defined in `.jshintrc`
- Maintain Apache 2.0 license headers in all files
- Use `should` for test assertions
- Prefer `fs-extra` over native `fs` for file operations

## Node Development

Core nodes are organized by category:
- **common** - Basic flow control nodes (inject, debug, catch, etc.)
- **function** - Function and template nodes
- **network** - HTTP, WebSocket, TCP, UDP nodes
- **parsers** - JSON, XML, CSV parsing nodes
- **sequence** - Split, join, sort, batch nodes
- **storage** - File operations and context storage

When developing new nodes, follow existing patterns and include comprehensive tests in the `/test/nodes/` directory.