import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AlternativeAccordion from '../components/alternativeAccordion';

describe('AlternativeAccordion', () => {
  it('renders a heading', () => {
    render(<AlternativeAccordion game={{ title: 'Test Game', description: 'Test Description' }} />);
    // Find all headings and check that at least one exists
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });
});
