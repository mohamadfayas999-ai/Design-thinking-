import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { GraduationCap, Shirt, ArrowRight, Droplets, Clock, CheckCircle2, Building2 } from 'lucide-react';
import { Card } from '../components/common/Card';
import { PageTransition } from '../components/common/PageTransition';
import {
  staggerContainerVariants,
  staggerItemVariants,
} from '../utils/animations';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  return (
    <PageTransition className="w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-8 pb-14 text-center max-w-4xl mx-auto">
        {/* Subtle Water Glow Accent (Low-contrast, gentle flow) */}
        {!shouldReduceMotion && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-water-200/25 rounded-full blur-3xl pointer-events-none -z-10"
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.25, 0.4, 0.25],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        <motion.div
          variants={staggerContainerVariants}
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
          className="flex flex-col items-center"
        >
          {/* Eyebrow badge */}
          <motion.div
            variants={staggerItemVariants}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-water-50 border border-water-200 text-water-700 text-xs font-semibold mb-6"
          >
            <Droplets className="w-3.5 h-3.5 text-water-600" />
            <span>Rajalakshmi Engineering College Hostels</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            variants={staggerItemVariants}
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight"
          >
            WASHWISE
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={staggerItemVariants}
            className="mt-3 text-lg sm:text-xl font-medium text-water-700"
          >
            Smart & Intelligent Campus Laundry Management
          </motion.p>

          {/* Value Prop Description */}
          <motion.p
            variants={staggerItemVariants}
            className="mt-4 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed"
          >
            A dedicated portal for hostel students, laundry staff, and college administration to schedule slots, monitor real-time washing status, and verify clothes with complete transparency.
          </motion.p>
        </motion.div>
      </section>

      {/* Primary Login Choice Cards (Exactly 2 choices: Rajalakshmi Engineering College & PG Hostel) */}
      <section className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h2 className="text-xs uppercase tracking-widest font-bold text-slate-500">
            Select Your Accommodation Portal
          </h2>
        </div>

        <motion.div
          variants={staggerContainerVariants}
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Option 1: Rajalakshmi Engineering College */}
          <motion.div variants={staggerItemVariants}>
            <Card
              hoverEffect
              className="h-full flex flex-col justify-between border-slate-200/80 hover:border-water-400 group cursor-pointer"
              onClick={() => navigate('/student/login?portal=rec')}
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-water-50 text-water-600 border border-water-100 flex items-center justify-center mb-5 group-hover:bg-water-600 group-hover:text-white transition-colors duration-200">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-water-700 transition-colors">
                    Rajalakshmi Engineering College
                  </h3>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-water-50 text-water-700 border border-water-200">
                    REC Campus
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Official on-campus laundry service exclusively for REC students. Select from <strong>Girls</strong>, <strong>Thandalam</strong>, or <strong>Habitat</strong> hostels to schedule and track laundry runs.
                </p>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-water-800 font-medium mb-6">
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/60">Girls Hostel</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/60">Thandalam Hostel</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/60">Habitat Hostel</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-water-700 group-hover:text-water-800">
                <span>Enter REC Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          </motion.div>

          {/* Option 2: PG Hostel */}
          <motion.div variants={staggerItemVariants}>
            <Card
              hoverEffect
              className="h-full flex flex-col justify-between border-slate-200/80 hover:border-water-400 group cursor-pointer"
              onClick={() => navigate('/student/login?portal=pg')}
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-water-50 text-water-600 border border-water-100 flex items-center justify-center mb-5 group-hover:bg-water-600 group-hover:text-white transition-colors duration-200">
                  <Building2 className="w-6 h-6" />
                </div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-slate-900 group-hover:text-water-700 transition-colors">
                    PG Hostel
                  </h3>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                    PG & Shared Living
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Dedicated shared accommodation laundry portal. Access demo resident accounts for <strong>User 1</strong>, <strong>User 2</strong>, <strong>User 3</strong>, and <strong>User 4</strong> across PG facilities.
                </p>
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-600 font-medium mb-6">
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/60">User 1</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/60">User 2</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/60">User 3</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200/60">User 4</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-water-700 group-hover:text-water-800">
                <span>Enter PG Hostel Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Card>
          </motion.div>
        </motion.div>

        {/* Secondary Staff & Administrative Access */}
        <div className="mt-8 pt-4 border-t border-slate-200/60 text-center">
          <p className="text-xs text-slate-500">
            Staff & Administrative Operations:{' '}
            <button
              type="button"
              onClick={() => navigate('/staff/login')}
              className="text-water-700 hover:text-water-800 font-semibold underline underline-offset-2 ml-1"
            >
              Laundry Staff Login
            </button>
            <span className="mx-2 text-slate-300">|</span>
            <button
              type="button"
              onClick={() => navigate('/admin/login')}
              className="text-water-700 hover:text-water-800 font-semibold underline underline-offset-2"
            >
              College Administrator Login
            </button>
          </p>
        </div>
      </section>

      {/* Key System Highlights */}
      <section className="mt-16 max-w-5xl mx-auto border-t border-slate-200/80 pt-10">
        <motion.div
          variants={staggerContainerVariants}
          initial={shouldReduceMotion ? false : 'initial'}
          animate="animate"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <motion.div variants={staggerItemVariants} className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-start gap-3">
            <Building2 className="w-5 h-5 text-water-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">3 Campus Hostels</h4>
              <p className="text-xs text-slate-500 mt-0.5">Habitat, Thandalam, and Girls hostels with dedicated queues.</p>
            </div>
          </motion.div>

          <motion.div variants={staggerItemVariants} className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-start gap-3">
            <Shirt className="w-5 h-5 text-water-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">20-Clothes Limit</h4>
              <p className="text-xs text-slate-500 mt-0.5">T-shirt/Shirt and Pants/Track with automatic limit validation.</p>
            </div>
          </motion.div>

          <motion.div variants={staggerItemVariants} className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-start gap-3">
            <Clock className="w-5 h-5 text-water-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">4 Runs Monthly</h4>
              <p className="text-xs text-slate-500 mt-0.5">Fair campus quota tracking with monthly usage monitoring.</p>
            </div>
          </motion.div>

          <motion.div variants={staggerItemVariants} className="p-4 rounded-xl bg-white border border-slate-200/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-water-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-900">Verify & Complaint</h4>
              <p className="text-xs text-slate-500 mt-0.5">Two-way verification at collection with admin resolution flow.</p>
            </div>
          </motion.div>
        </motion.div>
      </section>
    </PageTransition>
  );
};
