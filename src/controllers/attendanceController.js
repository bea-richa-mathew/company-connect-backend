
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function listAttendance(req, res) {
  try {
    const filter =
      req.user.role === "admin"
        ? {}
        : { employee: req.user.id };

    if (req.query.employee) {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "You can only view your own attendance",
        });
      }

      if (!mongoose.isValidObjectId(req.query.employee)) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }

      filter.employee = req.query.employee;
    }

    if (req.query.date) {
      filter.date = req.query.date;
    }

    const records = await Attendance.find(filter)
      .populate("employee", "name email employeeId department")
      .sort({ date: -1, checkIn: -1 });

    return res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch attendance records",
    });
  }
}

export async function getTodayAttendance(req, res) {
  try {
    const date = localDateKey();

    const filter =
      req.user.role === "admin"
        ? { date }
        : { employee: req.user.id, date };

    const records = await Attendance.find(filter)
      .populate("employee", "name email employeeId department")
      .sort({ checkIn: -1 });

    return res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch today's attendance",
    });
  }
}

export async function attendanceSummary(req, res) {
  try {
    let employeeId = null;

    if (req.user.role === "admin") {
      employeeId = req.query.employee || null;

      if (
        employeeId &&
        !mongoose.isValidObjectId(employeeId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid employee ID",
        });
      }
    } else {
      employeeId = req.user.id;
    }

    const match = employeeId
      ? {
          employee: new mongoose.Types.ObjectId(
            employeeId.toString()
          ),
        }
      : {};

    const summary = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const totals = {
      Present: 0,
      Absent: 0,
      "Half-day": 0,
      Leave: 0,
    };

    for (const item of summary) {
      if (Object.hasOwn(totals, item._id)) {
        totals[item._id] = item.count;
      }
    }

    return res.json({
      success: true,
      data: {
        ...totals,
        total: Object.values(totals).reduce(
          (sum, value) => sum + value,
          0
        ),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to calculate attendance summary",
    });
  }
}

export async function checkIn(req, res) {
  try {
    const date = localDateKey();

    const existingRecord = await Attendance.findOne({
      employee: req.user.id,
      date,
    });

    if (existingRecord?.checkIn) {
      return res.status(409).json({
        success: false,
        message: "You have already checked in today",
        data: existingRecord,
      });
    }

    let record;

    if (!existingRecord) {
      record = await Attendance.create({
        employee: req.user.id,
        date,
        checkIn: new Date(),
        status: "Present",
      });
    } else {
      existingRecord.checkIn = new Date();
      existingRecord.status = "Present";
      record = await existingRecord.save();
    }

    await record.populate(
      "employee",
      "name email employeeId department"
    );

    return res.status(201).json({
      success: true,
      message: "Check-in recorded successfully",
      data: record,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Attendance has already been recorded for today",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to record check-in",
    });
  }
}

export async function checkOut(req, res) {
  try {
    const date = localDateKey();

    const record = await Attendance.findOne({
      employee: req.user.id,
      date,
    });

    if (!record?.checkIn) {
      return res.status(400).json({
        success: false,
        message: "Check in before checking out",
      });
    }

    if (record.checkOut) {
      return res.status(409).json({
        success: false,
        message: "You have already checked out today",
      });
    }

    record.checkOut = new Date();
    await record.save();

    await record.populate(
      "employee",
      "name email employeeId department"
    );

    return res.json({
      success: true,
      message: "Check-out recorded successfully",
      data: record,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to record check-out",
    });
  }
}

export async function adminRecordAttendance(req, res) {
  try {
    const { employee, date, status, notes } = req.body;

    const allowedStatuses = [
      "Present",
      "Absent",
      "Half-day",
      "Leave",
    ];

    if (!employee || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "Employee, date and status are required",
      });
    }

    if (!mongoose.isValidObjectId(employee)) {
      return res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "Date must be in YYYY-MM-DD format",
      });
    }

    const parsedDate = new Date(`${date}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    const record = await Attendance.findOneAndUpdate(
      { employee, date },
      {
        $set: {
          status,
          notes: notes || "",
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).populate("employee", "name email employeeId department");

    return res.json({
      success: true,
      message: "Attendance recorded successfully",
      data: record,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to record attendance",
    });
  }
}
