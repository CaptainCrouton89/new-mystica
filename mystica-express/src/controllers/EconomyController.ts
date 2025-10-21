import { Request, Response, NextFunction } from 'express';
import { economyService } from '../services/EconomyService.js';
import { CombatRepository } from '../repositories/CombatRepository.js';
import { TransactionSourceType, TransactionSinkType } from '../types/api.types.js';
import type { AffordabilityCheckRequest, AddCurrencyRequest, DeductCurrencyRequest } from '../types/schemas.js';

const combatRepository = new CombatRepository();

/**
 * Economy Controller
 * Handles currency operations, balance queries, and affordability checks
 */
export class EconomyController {
  /**
   * GET /economy/balances
   * Get all currency balances for authenticated user
   */
  getAllBalances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const balances = await economyService.getAllBalances(userId);

      res.json({
        success: true,
        balances
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /economy/balance/:currency
   * Get specific currency balance for authenticated user
   */
  getCurrencyBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const currency = req.params.currency.toUpperCase() as 'GOLD' | 'GEMS';

      if (currency !== 'GOLD' && currency !== 'GEMS') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CURRENCY',
            message: 'Currency must be GOLD or GEMS'
          }
        });
        return;
      }

      const balance = await economyService.getCurrencyBalance(userId, currency);

      res.json({
        success: true,
        currency,
        balance
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /economy/affordability
   * Check if user can afford a purchase
   * Body: { currency: 'GOLD' | 'GEMS', amount: number }
   */
  checkAffordability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { currency, amount } = req.validated?.body as AffordabilityCheckRequest;

      const result = await economyService.getAffordabilityCheck(userId, currency, amount);

      res.json({
        success: true,
        affordability: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /economy/add
   * Add currency to user balance (admin/debug endpoint)
   * Body: { currency: 'GOLD' | 'GEMS', amount: number, sourceType: string, sourceId?: string, metadata?: object }
   */
  addCurrency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { currency, amount, sourceType, sourceId, metadata } = req.validated?.body as AddCurrencyRequest;

      const result = await economyService.addCurrency(
        userId,
        currency,
        amount,
        sourceType as TransactionSourceType,
        sourceId,
        metadata
      );

      res.json({
        success: true,
        transaction: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /economy/deduct
   * Deduct currency from user balance (admin/debug endpoint)
   * Body: { currency: 'GOLD' | 'GEMS', amount: number, sourceType: string, sourceId?: string, metadata?: object }
   */
  deductCurrency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { currency, amount, sourceType, sourceId, metadata } = req.validated?.body as DeductCurrencyRequest;

      const result = await economyService.deductCurrency(
        userId,
        currency,
        amount,
        sourceType as TransactionSinkType,
        sourceId,
        metadata
      );

      res.json({
        success: true,
        transaction: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /economy/players/combat-history/:location_id
   * Get player's combat history at specific location (F-12 Enemy AI)
   * Note: This is misplaced in EconomyController but kept here for route compatibility
   */
  getCombatHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const locationId = req.params.location_id;

      const history = await combatRepository.getPlayerHistory(userId, locationId);

      if (!history) {
        res.json({
          success: true,
          history: {
            location_id: locationId,
            total_attempts: 0,
            victories: 0,
            defeats: 0,
            current_streak: 0,
            longest_streak: 0,
            last_attempt: null
          }
        });
        return;
      }

      res.json({
        success: true,
        history: {
          location_id: locationId,
          total_attempts: history.totalAttempts,
          victories: history.victories,
          defeats: history.defeats,
          current_streak: history.currentStreak,
          longest_streak: history.longestStreak,
          last_attempt: history.lastAttempt
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

export const economyController = new EconomyController();