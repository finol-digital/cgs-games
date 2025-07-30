import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AlternativeAccordion from '../components/alternativeAccordion';

describe('AlternativeAccordion', () => {
  it('renders a heading', () => {
    render(
      <AlternativeAccordion
        game={{ name: 'Test Game', autoUpdateUrl: 'https://example.com/test.cgs' }}
        cgsgg="https://example.com/cgsgg"
      />,
    );
    // Find all headings and check that at least one exists
    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });
});
