import '../tests/parseMock';
import walletFunctions from '../cloudCode/modules/Wallet/functions';

const {Parse} = global as any;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

jest.mock('../cloudCode/models/Wallet', () => {
  return {
    __esModule: true,
    default: class FakeWallet {
      id = 'wallet1';
      attributes: any = {};
      set(key: string, value: any) {
        this.attributes[key] = value;
      }
      get(key: string) {
        return this.attributes[key];
      }
      async save() {
        return this;
      }
    },
  };
});

describe('WalletFunctions', () => {
  describe('getWalletBalance', () => {
    it('should throw error if session token is missing', async () => {
      const req: any = {
        headers: {},
      };

      await expect(walletFunctions.getWalletBalance(req)).rejects.toMatchObject(
        {
          codeStatus: 101,
        }
      );
    });

    it('should throw error if session token is invalid', async () => {
      jest.spyOn(Parse.Query.prototype, 'first').mockResolvedValueOnce(null);

      const req: any = {
        headers: {
          'x-parse-session-token': 'invalid-token',
        },
      };

      await expect(walletFunctions.getWalletBalance(req)).rejects.toMatchObject(
        {
          codeStatus: 101,
        }
      );
    });

    it('should throw error if user context is missing', async () => {
      const fakeSession = {
        get: (field: string) => null,
      };

      jest
        .spyOn(Parse.Query.prototype, 'first')
        .mockResolvedValueOnce(fakeSession);

      const req: any = {
        headers: {
          'x-parse-session-token': 'valid-token',
        },
      };

      await expect(walletFunctions.getWalletBalance(req)).rejects.toMatchObject(
        {
          codeStatus: 103,
        }
      );
    });
  });
  it('should create a new wallet if none exists and return balance 0', async () => {
    const fakeUser = {id: 'user1'};

    const fakeSession = {
      get: (field: string) => {
        if (field === 'user') return fakeUser;
        return null;
      },
    };

    jest
      .spyOn(Parse.Query.prototype, 'first')
      .mockResolvedValueOnce(fakeSession)
      .mockResolvedValueOnce(null);

    const req: any = {
      headers: {
        'x-parse-session-token': 'valid-token',
      },
    };

    const result = await walletFunctions.getWalletBalance(req);

    expect(result).toMatchObject({
      balance: 0,
      message: 'Wallet created successfully',
    });

    expect(result).toHaveProperty('wallet_id');
  });
});
