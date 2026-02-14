import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import Footer from '../components/footer';

describe('Footer', () => {
  it('renders with default copyright notice', () => {
    render(<Footer />);
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`Finol Digital LLC ©${currentYear}`))).toBeInTheDocument();
  });

  it('renders with custom copyright notice', () => {
    const customNotice = 'Game Name is copyright/TM of Copyright Holder; CGS is unaffiliated';
    render(<Footer copyrightNotice={customNotice} />);
    expect(screen.getByText(customNotice)).toBeInTheDocument();
  });

  it('applies proper spacing classes to copyright notice', () => {
    const customNotice = 'Long Game Name is copyright/TM of Copyright Holder; CGS is unaffiliated';
    const { container } = render(<Footer copyrightNotice={customNotice} />);
    const paragraph = container.querySelector('p');
    // Check that it has py-2 (vertical padding) instead of fixed height
    expect(paragraph).toHaveClass('py-2');
    expect(paragraph).toHaveClass('text-center');
    expect(paragraph).not.toHaveClass('h-10');
  });

  it('renders footer navigation links', () => {
    render(<Footer />);
    expect(screen.getByText('CGS Games')).toBeInTheDocument();
    expect(screen.getByText('Browse')).toBeInTheDocument();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('Terms')).toBeInTheDocument();
    expect(screen.getByText('Privacy')).toBeInTheDocument();
  });

  it('uses flexible padding instead of fixed height for gold footer section', () => {
    const { container } = render(<Footer />);
    const goldDiv = container.querySelector('.bg-\\[var\\(--color-gold\\)\\]');
    // Verify it uses padding (py-8 pb-4) instead of fixed height (h-48)
    expect(goldDiv).toHaveClass('py-8');
    expect(goldDiv).toHaveClass('pb-4');
    expect(goldDiv).not.toHaveClass('h-48');
  });
});
