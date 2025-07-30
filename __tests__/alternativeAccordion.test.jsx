import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AlternativeAccordion from '../components/alternativeAccordion';

describe('AlternativeAccordion', () => {
  it('renders a heading', () => {
    render(<AlternativeAccordion game={{ title: 'Test Game', description: 'Test Description' }} />);

    const heading = screen.getByRole('heading', { level: 4 });

    expect(heading).toBeInTheDocument();
  });
});
