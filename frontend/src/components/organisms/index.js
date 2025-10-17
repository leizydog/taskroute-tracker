
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiPlus, FiRoute, FiEye, FiBrain, FiCheckSquare, FiTrendingUp,
  FiCalendar, FiMapPin, FiFilter, FiSearch, FiDownload
} from 'react-icons/fi';
import { Card, Button, Badge, Input, Select, Modal, Spinner, Alert } from './atoms';
import {
  EmployeeListItem, KPIMetric, TaskCard, PerformanceForecast,
  EmployeeInfoCard, LocationBadge, TaskStatusTimeline, ComparisonCard
} from './molecules';