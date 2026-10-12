import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { User } from 'firebase/auth';
import UsernameForm from '@/components/usernameForm';
import { UserContext } from '@/lib/context';
import { getDoc, writeBatch } from 'firebase/firestore';

jest.mock('@/lib/firebase/firestore', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, ...parts) => parts.join('/')),
  getDoc: jest.fn(),
  writeBatch: jest.fn(),
}));
const read = jest.mocked(getDoc);
const batch = { set: jest.fn(), commit: jest.fn() };
const user = { uid: 'creator-uid' } as User;
const setup = () =>
  render(
    <UserContext.Provider value={{ user, username: null }}>
      <UsernameForm />
    </UserContext.Provider>,
  );
const enter = (name: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: 'Username' }), { target: { value: name } });
const tick = async () => {
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  read.mockResolvedValue({ exists: () => false } as Awaited<ReturnType<typeof getDoc>>);
  batch.commit.mockResolvedValue(undefined);
  jest.mocked(writeBatch).mockReturnValue(batch as unknown as ReturnType<typeof writeBatch>);
});
afterEach(() => jest.useRealTimers());

describe('username creation form', () => {
  it.each([
    'api',
    'about',
    'contact',
    'developers',
    'cli',
    'downloads',
    'browse',
    'upload',
    'robots.txt',
  ])('rejects %s without an availability read or write', async (name) => {
    const { container } = setup();
    enter(name);
    await tick();
    expect(screen.getByText('That username is reserved for CGS Games.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
    fireEvent.submit(container.querySelector('form')!);
    expect(read).not.toHaveBeenCalled();
    expect(writeBatch).not.toHaveBeenCalled();
  });
  it('ignores an earlier available result after the input changes to a reserved name', async () => {
    const { promise, resolve } = Promise.withResolvers<Awaited<ReturnType<typeof getDoc>>>();
    read.mockReturnValueOnce(promise);
    setup();
    enter('alice');
    await tick();
    enter('about');
    await act(async () => resolve({ exists: () => false } as Awaited<ReturnType<typeof getDoc>>));
    expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
    expect(screen.getByText('That username is reserved for CGS Games.')).toBeVisible();
  });
  it('requires the current name to finish checking and commits matching ownership atomically', async () => {
    setup();
    enter('ALICE');
    await tick();
    enter('bob');
    expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
    await tick();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Choose' })));
    expect(batch.set.mock.calls).toEqual([
      ['users/creator-uid', { username: 'bob' }],
      ['usernames/bob', { uid: 'creator-uid' }],
    ]);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
  it('fails closed when availability cannot be checked', async () => {
    read.mockRejectedValueOnce(new Error('offline'));
    setup();
    enter('alice');
    await tick();
    expect(screen.getByText('Could not check availability. Please try again.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
  });
  it('retains the completed lookup when only the input casing changes', async () => {
    setup();
    enter('alice');
    await tick();
    enter('ALICE');
    expect(screen.getByRole('textbox', { name: 'Username' })).toHaveValue('alice');
    expect(screen.getByRole('button', { name: 'Choose' })).toBeEnabled();
    expect(read).toHaveBeenCalledTimes(1);
  });
  it('handles a name claimed between availability and submission', async () => {
    batch.commit.mockRejectedValueOnce(new Error('permission denied'));
    setup();
    enter('alice');
    await tick();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Choose' })));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save this username');
    expect(screen.getByRole('button', { name: 'Choose' })).toBeDisabled();
  });
});
