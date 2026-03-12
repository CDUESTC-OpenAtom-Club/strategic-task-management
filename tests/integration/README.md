# Integration Tests

This directory contains integration tests for the frontend architecture refactoring project. These tests validate the integration between different layers of the FSD (Feature-Sliced Design) architecture.

## Test Structure

### API Integration Tests (`api/`)
- **strategic-indicator.integration.test.ts**: Tests API layer integration with strategic indicator store
- **auth.integration.test.ts**: Tests authentication API integration with auth store

### State Management Integration Tests (`state/`)
- **cross-feature-state.integration.test.ts**: Tests interactions between different feature stores

### Routing Integration Tests (`routing/`)
- **navigation.integration.test.ts**: Tests Vue Router integration with auth guards and navigation flows

### Full Flow Integration Tests
- **full-flow.integration.test.ts**: End-to-end integration tests combining API, state, and routing

## What These Tests Validate

### 1. API Integration
- ✅ API calls through store methods
- ✅ Error handling and state updates
- ✅ Data transformation and response handling
- ✅ Concurrent API call management
- ✅ Request/response flow validation

### 2. State Management Integration
- ✅ Cross-feature store interactions
- ✅ Auth state impact on other features
- ✅ Shared state synchronization
- ✅ Error state propagation
- ✅ Loading state coordination

### 3. Route Navigation Integration
- ✅ Authentication-based navigation guards
- ✅ Role-based access control
- ✅ Navigation state persistence
- ✅ Route parameter handling
- ✅ Navigation error handling

### 4. Complete User Workflows
- ✅ Login → Navigation → Data Fetch flow
- ✅ Data modification workflows (CRUD)
- ✅ Error recovery and state consistency
- ✅ Session persistence across page refresh

## Running Integration Tests

```bash
# Run all integration tests
npm test -- tests/integration

# Run specific integration test suites
npm test -- tests/integration/api
npm test -- tests/integration/state
npm test -- tests/integration/routing

# Run specific test file
npm test -- tests/integration/full-flow.integration.test.ts

# Run with coverage
npm run test:coverage -- tests/integration
```

## Key Testing Patterns

### 1. Store Integration Testing
```typescript
beforeEach(() => {
  setActivePinia(createPinia())
  authStore = useAuthStore()
  indicatorStore = useIndicatorStore()
})
```

### 2. API Mocking for Integration
```typescript
vi.mock('@/shared/lib/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))
```

### 3. Router Integration Testing
```typescript
const router = createRouter({
  history: createWebHistory(),
  routes: testRoutes
})

router.beforeEach((to, from, next) => {
  // Test navigation guards
})
```

### 4. Full Flow Testing
```typescript
// Test complete workflows
await authStore.login(credentials)
await router.push('/protected-route')
await dataStore.fetchData()
// Verify end-to-end state
```

## Architecture Validation

These integration tests specifically validate the FSD architecture principles:

1. **Layer Separation**: Tests verify that features interact correctly through defined interfaces
2. **Dependency Direction**: Tests ensure lower layers don't depend on higher layers
3. **Feature Isolation**: Tests verify features can work independently
4. **Shared Resource Usage**: Tests validate proper use of shared utilities and API clients

## Test Coverage Goals

- **API Integration**: 100% of API endpoints used by stores
- **State Interactions**: All cross-feature state dependencies
- **Navigation Flows**: All protected routes and role-based access
- **Error Scenarios**: Network failures, authentication errors, validation failures
- **Edge Cases**: Concurrent operations, session restoration, state recovery

## Maintenance Notes

- Update tests when adding new API endpoints
- Add integration tests for new features
- Verify tests when modifying navigation guards
- Update mocks when changing API interfaces
- Test new cross-feature interactions

These integration tests complement the unit tests by validating that the refactored FSD architecture works correctly as an integrated system.