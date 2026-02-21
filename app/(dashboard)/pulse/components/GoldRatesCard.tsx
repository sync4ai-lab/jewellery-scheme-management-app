"use client";
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit } from 'lucide-react';
import React from 'react';

export function GoldRatesCard({
  currentRates = { k18: null, k22: null, k24: null, silver: null },
  onUpdate,
}: {
  currentRates: {
    k18: { rate: number; validFrom: string } | null;
    k22: { rate: number; validFrom: string } | null;
    k24: { rate: number; validFrom: string } | null;
    silver: { rate: number; validFrom: string } | null;
  };
  onUpdate: () => void;
}) {
  return (
    <Card className="jewel-card">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Precious Metals Vault - Current Rates</p>
              <p className="text-xs text-muted-foreground">Per gram pricing across all metal types</p>
            </div>
            <Button onClick={onUpdate} className="jewel-gradient text-white hover:opacity-90 rounded-xl">
              <Edit className="w-4 h-4 mr-2" />
              Update Rates
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 18K Gold */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-800/10 border-2 border-amber-200/50 dark:border-amber-700/30">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700">18K</Badge>
              </div>
              {currentRates.k18 ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">₹{currentRates.k18.rate.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/gram</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Updated: {new Date(currentRates.k18.validFrom).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not set</p>
              )}
            </div>
            {/* 22K Gold */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-gold-50 to-gold-100/50 dark:from-gold-900/20 dark:to-gold-800/10 border-2 border-gold-200/50 dark:border-gold-700/30">
              <div className="flex items-center justify-between mb-2">
                <Badge className="bg-gold-200 dark:bg-gold-900/50 border-gold-400 dark:border-gold-600 text-gold-800 dark:text-gold-200">22K • Standard</Badge>
              </div>
              {currentRates.k22 ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold gold-text">₹{currentRates.k22.rate.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/gram</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Updated: {new Date(currentRates.k22.validFrom).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not set</p>
              )}
            </div>
            {/* 24K Gold */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-yellow-50 to-yellow-100/50 dark:from-yellow-900/20 dark:to-yellow-800/10 border-2 border-yellow-200/50 dark:border-yellow-700/30">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700">24K • Pure</Badge>
              </div>
              {currentRates.k24 ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">₹{currentRates.k24.rate.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/gram</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Updated: {new Date(currentRates.k24.validFrom).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not set</p>
              )}
            </div>
            {/* Silver */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/20 dark:to-slate-800/10 border-2 border-slate-200/50 dark:border-slate-700/30">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-900/30 border-slate-300 dark:border-slate-700">SILVER</Badge>
              </div>
              {currentRates.silver ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-600 dark:text-slate-400">₹{currentRates.silver.rate.toLocaleString()}</span>
                    <span className="text-sm text-muted-foreground">/gram</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Updated: {new Date(currentRates.silver.validFrom).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not set</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
