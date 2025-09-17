﻿import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, Shield, TrendingUp, Zap } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

interface WelcomeScreenProps {
    onNext?: () => void;           // ← Changed from onStart to onNext
    onPrevious?: () => void;       // ← Added for consistency
    onGoToStep?: (step: string) => void;  // ← Added for consistency
    currentStep?: string;          // ← Added for consistency
    merchantProfile?: any;         // ← Added for consistency
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNext }) => {
    const benefits = [
        {
            icon: Zap,
            title: 'Digital Payments',
            description: 'Accept payments instantly with UPI, cards, and digital wallets'
        },
        {
            icon: TrendingUp,
            title: 'Business Growth',
            description: 'Analytics and loyalty programs to drive customer retention'
        },
        {
            icon: Shield,
            title: 'Secure & Reliable',
            description: 'AI-powered fraud detection and real-time security monitoring'
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
            <div className="container max-w-4xl mx-auto px-4">
                <div className="bg-card rounded-3xl shadow-[var(--shadow-elegant)] p-12 text-center">
                    {/* Logo and Branding */}
                    <div className="mb-8">
                        <Logo size="lg" className="mb-6" />
                        <h1 className="text-4xl font-bold mb-3 bg-[var(--gradient-primary)] bg-clip-text text-transparent">
                            Welcome to SabbPe
                        </h1>
                        <p className="text-xl text-muted-foreground mb-2">
                            India's Digital Payments Partner
                        </p>
                        <p className="text-lg text-foreground font-medium">
                            Payments Simplified. Business Amplified.
                        </p>
                    </div>

                    {/* Benefits Grid */}
                    <div className="grid md:grid-cols-3 gap-6 mb-10">
                        {benefits.map((benefit, index) => (
                            <div
                                key={index}
                                className="p-6 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 hover:from-primary/10 hover:to-accent/10 transition-all duration-300"
                            >
                                <benefit.icon className="h-12 w-12 text-primary mx-auto mb-4" />
                                <h3 className="font-semibold text-foreground mb-2">
                                    {benefit.title}
                                </h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {benefit.description}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10 p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-primary">10+</div>
                            <div className="text-sm text-muted-foreground">Banking Alliances</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-primary">5+</div>
                            <div className="text-sm text-muted-foreground">Coverage Cities</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-primary">1000+</div>
                            <div className="text-sm text-muted-foreground">Happy Merchants</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-primary">18/7</div>
                            <div className="text-sm text-muted-foreground">Service Support</div>
                        </div>
                    </div>

                    {/* CTA */}
                    <div className="space-y-4">
                        <Button
                            onClick={onNext}  // ← Changed from onStart to onNext
                            size="lg"
                            className="px-8 py-6 text-lg font-semibold rounded-xl shadow-[var(--shadow-elegant)] hover:shadow-lg transition-all duration-300"
                        >
                            Start Your Onboarding Journey
                        </Button>
                        <p className="text-sm text-muted-foreground">
                            Join thousands of merchants growing their business with SabbPe
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};