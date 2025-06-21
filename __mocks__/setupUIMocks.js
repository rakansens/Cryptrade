// Setup UI component mocks for Jest
jest.mock('@/components/ui/button', () => require('@/components/ui/button'));
jest.mock('@/components/ui/input', () => require('@/components/ui/input'));
jest.mock('@/components/ui/card', () => require('@/components/ui/card'));
jest.mock('@/components/ui/dialog', () => require('@/components/ui/dialog'));
jest.mock('@/components/ui/switch', () => require('@/components/ui/switch'));
jest.mock('@/components/ui/slider', () => require('@/components/ui/slider'));
jest.mock('@/components/ui/tabs', () => require('@/components/ui/tabs'));
jest.mock('@/components/ui/select', () => require('@/components/ui/select'));
jest.mock('@/components/ui/popover', () => require('@/components/ui/popover'));
jest.mock('@/components/ui/toast', () => require('@/components/ui/toast'));