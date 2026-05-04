import { NextFunction, Response } from 'express';
import { ROLES_GLOBAUX } from '../types';
import { AuthRequest } from './auth';

// Vérifie que l'utilisateur a un des rôles requis
export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, message: 'Accès refusé : rôle insuffisant' });
      return;
    }
    next();
  };
};

// Vérifie que l'utilisateur est un profil global (accès à tout)
export const requireGlobalAccess = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Non authentifié' });
    return;
  }
  if (!ROLES_GLOBAUX.includes(req.user.role)) {
    res.status(403).json({ success: false, message: 'Accès réservé aux profils globaux' });
    return;
  }
  next();
};

// Vérifie Admin uniquement
export const requireAdmin = requireRole('ADMIN');
