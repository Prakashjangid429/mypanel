import mongoose from 'mongoose';
import User from '../models/user.model.js';
import EwalletTransaction from '../models/ewallet.model.js';
import MainWalletTransaction from '../models/mainWallet.model.js';
import PayoutReport from '../models/payoutRecord.model.js';
import PayinGenerationRecord from '../models/payinRequests.model.js';

// Helper function to get date ranges
const getDateRange = (days) => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);
  return { startDate, endDate };
};

// Get analytics dashboard data
export const getWalletAnalytics = async (req, res) => {
  try {
    const { range = '7d' } = req.query;
    let days;
    
    switch(range) {
      case '7d': days = 3; break;
      case '30d': days = 30; break;
      case '90d': days = 90; break;
      case '1y': days = 365; break;
      default: days = 3;
    }
    
    const { startDate, endDate } = getDateRange(days);
    
    // For admin - show all users data
    if (req.user.role === 'Admin' || req.user.role === 'Manager') {
      // Get total wallet balances across all users
      const totalBalances = await User.aggregate([
        {
          $group: {
            _id: null,
            totalEWallet: { $sum: "$eWalletBalance" },
            totalMainWallet: { $sum: "$upiWalletBalance" },
            userCount: { $sum: 1 }
          }
        }
      ]);
      
      // Get transaction stats
      const [ewalletStats, mainWalletStats, payins, payouts] = await Promise.all([
        EwalletTransaction.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              totalCharges: { $sum: "$charges" },
              creditCount: { 
                $sum: { $cond: [{ $eq: ["$type", "credit"] }, 1, 0] }
              },
              debitCount: { 
                $sum: { $cond: [{ $eq: ["$type", "debit"] }, 1, 0] }
              },
              creditAmount: { 
                $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] }
              },
              debitAmount: { 
                $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] }
              }
            }
          }
        ]),
        
        MainWalletTransaction.aggregate([
          {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              totalCharges: { $sum: "$charges" },
              creditCount: { 
                $sum: { $cond: [{ $eq: ["$type", "credit"] }, 1, 0] }
              },
              debitCount: { 
                $sum: { $cond: [{ $eq: ["$type", "debit"] }, 1, 0] }
              },
              creditAmount: { 
                $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] }
              },
              debitAmount: { 
                $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] }
              }
            }
          }
        ]),
        
        PayinGenerationRecord.aggregate([
          {
            $match: {
              status: "Success",
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              totalCharges: { $sum: "$chargeAmount" },
              count: { $sum: 1 }
            }
          }
        ]),
        
        PayoutReport.aggregate([
          {
            $match: {
              status: "Success",
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              totalCharges: { $sum: "$gatewayCharge" },
              count: { $sum: 1 }
            }
          }
        ])
      ]);
      
      // Get daily data for charts
      const dailyData = await getDailyTransactionData(startDate, endDate);
      // Prepare response
      const response = {
        success: true,
        data: {
          // Wallet balances
          totalEWalletBalance: totalBalances[0]?.totalEWallet || 0,
          totalMainWalletBalance: totalBalances[0]?.totalMainWallet || 0,
          userCount: totalBalances[0]?.userCount || 0,
          
          // Transaction stats
          ewalletTransactions: {
            totalAmount: ewalletStats[0]?.totalAmount || 0,
            totalCharges: ewalletStats[0]?.totalCharges || 0,
            creditCount: ewalletStats[0]?.creditCount || 0,
            debitCount: ewalletStats[0]?.debitCount || 0,
            creditAmount: ewalletStats[0]?.creditAmount || 0,
            debitAmount: ewalletStats[0]?.debitAmount || 0
          },
          
          mainWalletTransactions: {
            totalAmount: mainWalletStats[0]?.totalAmount || 0,
            totalCharges: mainWalletStats[0]?.totalCharges || 0,
            creditCount: mainWalletStats[0]?.creditCount || 0,
            debitCount: mainWalletStats[0]?.debitCount || 0,
            creditAmount: mainWalletStats[0]?.creditAmount || 0,
            debitAmount: mainWalletStats[0]?.debitAmount || 0
          },
          
          payIns: {
            totalAmount: payins[0]?.totalAmount || 0,
            totalCharges: payins[0]?.totalCharges || 0,
            count: payins[0]?.count || 0
          },
          
          payOuts: {
            totalAmount: payouts[0]?.totalAmount || 0,
            totalCharges: payouts[0]?.totalCharges || 0,
            count: payouts[0]?.count || 0
          },
          dailyData,
        }
      };
      
      return res.status(200).json(response);
    } 
    else {
      const userId = req.user._id;
      
      const [user, ewalletStats, mainWalletStats, payins, payouts] = await Promise.all([
        User.findById(userId),
        
        EwalletTransaction.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(userId),
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              totalCharges: { $sum: "$charges" },
              creditCount: { 
                $sum: { $cond: [{ $eq: ["$type", "credit"] }, 1, 0] }
              },
              debitCount: { 
                $sum: { $cond: [{ $eq: ["$type", "debit"] }, 1, 0] }
              },
              creditAmount: { 
                $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] }
              },
              debitAmount: { 
                $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] }
              }
            }
          }
        ]),
        
        MainWalletTransaction.aggregate([
          {
            $match: {
              userId: new mongoose.Types.ObjectId(userId),
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              totalCharges: { $sum: "$charges" },
              creditCount: { 
                $sum: { $cond: [{ $eq: ["$type", "credit"] }, 1, 0] }
              },
              debitCount: { 
                $sum: { $cond: [{ $eq: ["$type", "debit"] }, 1, 0] }
              },
              creditAmount: { 
                $sum: { $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0] }
              },
              debitAmount: { 
                $sum: { $cond: [{ $eq: ["$type", "debit"] }, "$amount", 0] }
              }
            }
          }
        ]),
        
        PayinGenerationRecord.aggregate([
          {
            $match: {
              user_id: new mongoose.Types.ObjectId(userId),
              status: "Success",
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              totalCharges: { $sum: "$chargeAmount" },
              count: { $sum: 1 }
            }
          }
        ]),
        
        PayoutReport.aggregate([
          {
            $match: {
              user_id: new mongoose.Types.ObjectId(userId),
              status: "Success",
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: "$amount" },
              totalCharges: { $sum: "$gatewayCharge" },
              count: { $sum: 1 }
            }
          }
        ])
      ]);
      
      // Get daily data for charts
      const dailyData = await getDailyUserTransactionData(userId, startDate, endDate);
      
      const response = {
        success: true,
        data: {
          // Wallet balances
          eWalletBalance: user.eWalletBalance,
          mainWalletBalance: user.upiWalletBalance,
          
          // Transaction stats
          ewalletTransactions: {
            totalAmount: ewalletStats[0]?.totalAmount || 0,
            totalCharges: ewalletStats[0]?.totalCharges || 0,
            creditCount: ewalletStats[0]?.creditCount || 0,
            debitCount: ewalletStats[0]?.debitCount || 0,
            creditAmount: ewalletStats[0]?.creditAmount || 0,
            debitAmount: ewalletStats[0]?.debitAmount || 0
          },
          
          mainWalletTransactions: {
            totalAmount: mainWalletStats[0]?.totalAmount || 0,
            totalCharges: mainWalletStats[0]?.totalCharges || 0,
            creditCount: mainWalletStats[0]?.creditCount || 0,
            debitCount: mainWalletStats[0]?.debitCount || 0,
            creditAmount: mainWalletStats[0]?.creditAmount || 0,
            debitAmount: mainWalletStats[0]?.debitAmount || 0
          },
          
          payIns: {
            totalAmount: payins[0]?.totalAmount || 0,
            totalCharges: payins[0]?.totalCharges || 0,
            count: payins[0]?.count || 0
          },
          
          payOuts: {
            totalAmount: payouts[0]?.totalAmount || 0,
            totalCharges: payouts[0]?.totalCharges || 0,
            count: payouts[0]?.count || 0
          },
          
          // Chart data
          dailyData,
        }
      };
      
      return res.status(200).json(response);
    }
  } catch (error) {
    console.error('Error in getWalletAnalytics:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Helper function to get daily transaction data (admin)
async function getDailyTransactionData(startDate, endDate) {
  const dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
  
  const [payIns, payOuts, transfers] = await Promise.all([
    PayinGenerationRecord.aggregate([
      {
        $match: {
          status: "Success",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: dateFormat,
          amount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    PayoutReport.aggregate([
      {
        $match: {
          status: "Success",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: dateFormat,
          amount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    EwalletTransaction.aggregate([
      {
        $match: {
          status: "success",
          description: { $regex: /transfer/i },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: dateFormat,
          amount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);
  
  // Get all unique dates
  const allDates = new Set();
  payIns.forEach(item => allDates.add(item._id));
  payOuts.forEach(item => allDates.add(item._id));
  transfers.forEach(item => allDates.add(item._id));
  
  const sortedDates = Array.from(allDates).sort();
  
  // Create daily data structure
  const dailyData = {
    dates: sortedDates,
    payIns: sortedDates.map(date => {
      const found = payIns.find(item => item._id === date);
      return found ? found.amount : 0;
    }),
    payOuts: sortedDates.map(date => {
      const found = payOuts.find(item => item._id === date);
      return found ? found.amount : 0;
    }),
    transfers: sortedDates.map(date => {
      const found = transfers.find(item => item._id === date);
      return found ? found.amount : 0;
    })
  };
  
  return dailyData;
}

// Helper function to get daily transaction data (user)
async function getDailyUserTransactionData(userId, startDate, endDate) {
  const dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
  
  const [payIns, payOuts, transfers] = await Promise.all([
    PayinGenerationRecord.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          status: "Success",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: dateFormat,
          amount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    PayoutReport.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(userId),
          status: "Success",
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: dateFormat,
          amount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    EwalletTransaction.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          status: "success",
          description: { $regex: /transfer/i },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: dateFormat,
          amount: { $sum: "$amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ])
  ]);
  
  // Get all unique dates
  const allDates = new Set();
  payIns.forEach(item => allDates.add(item._id));
  payOuts.forEach(item => allDates.add(item._id));
  transfers.forEach(item => allDates.add(item._id));
  
  const sortedDates = Array.from(allDates).sort();
  
  // Create daily data structure
  const dailyData = {
    dates: sortedDates,
    payIns: sortedDates.map(date => {
      const found = payIns.find(item => item._id === date);
      return found ? found.amount : 0;
    }),
    payOuts: sortedDates.map(date => {
      const found = payOuts.find(item => item._id === date);
      return found ? found.amount : 0;
    }),
    transfers: sortedDates.map(date => {
      const found = transfers.find(item => item._id === date);
      return found ? found.amount : 0;
    })
  };
  
  return dailyData;
}