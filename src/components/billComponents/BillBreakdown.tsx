import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Receipt, Stethoscope, Pill, TestTube, Plus } from 'lucide-react';
import { Button } from '../ui/Button';

interface BillLineItem {
  id?: string;
  item_type: 'consultation' | 'procedure' | 'medicine' | 'test' | 'other';
  item_name: string;
  item_description?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface BillBreakdownProps {
  bill: {
    id: string;
    amount: number;
    tax_amount?: number;
    discount_amount?: number;
    total_amount: number;
    line_items?: BillLineItem[];
  };
  editable?: boolean;
  onAddItem?: (item: Omit<BillLineItem, 'id'>) => void;
  onUpdateItem?: (itemId: string, item: Partial<BillLineItem>) => void;
  onRemoveItem?: (itemId: string) => void;
}

const getItemIcon = (type: string) => {
  switch (type) {
    case 'consultation':
      return <Stethoscope className="h-4 w-4 text-blue-600" />;
    case 'procedure':
      return <Receipt className="h-4 w-4 text-green-600" />;
    case 'medicine':
      return <Pill className="h-4 w-4 text-purple-600" />;
    case 'test':
      return <TestTube className="h-4 w-4 text-orange-600" />;
    default:
      return <Receipt className="h-4 w-4 text-gray-600" />;
  }
};

const getItemTypeColor = (type: string) => {
  switch (type) {
    case 'consultation':
      return 'bg-blue-50 text-blue-800';
    case 'procedure':
      return 'bg-green-50 text-green-800';
    case 'medicine':
      return 'bg-purple-50 text-purple-800';
    case 'test':
      return 'bg-orange-50 text-orange-800';
    default:
      return 'bg-gray-50 text-gray-800';
  }
};

export const BillBreakdown: React.FC<BillBreakdownProps> = ({
  bill,
  editable = false,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<Omit<BillLineItem, 'id'>>({
    item_type: 'other',
    item_name: '',
    item_description: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
  });

  const lineItems = bill.line_items || [
    // Fallback: create line items from bill totals
    {
      id: 'default-consultation',
      item_type: 'consultation' as const,
      item_name: 'Consultation Fee',
      item_description: 'Medical consultation',
      quantity: 1,
      unit_price: bill.amount,
      total_price: bill.amount,
    },
  ];

  const handleAddItem = () => {
    if (onAddItem && newItem.item_name && newItem.unit_price > 0) {
      const itemToAdd = {
        ...newItem,
        total_price: newItem.quantity * newItem.unit_price,
      };
      onAddItem(itemToAdd);
      setNewItem({
        item_type: 'other',
        item_name: '',
        item_description: '',
        quantity: 1,
        unit_price: 0,
        total_price: 0,
      });
      setShowAddForm(false);
    }
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total_price, 0);
  const tax = bill.tax_amount || 0;
  const discount = bill.discount_amount || 0;
  const total = bill.total_amount;

  return (
    <div className="border border-gray-200 rounded-lg">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Receipt className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-900">Bill Breakdown</span>
          <span className="text-sm text-gray-500">
            ({lineItems.length} item{lineItems.length !== 1 ? 's' : ''})
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-gray-900">₹{total.toFixed(2)}</span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Line Items */}
          <div className="p-4 space-y-3">
            {lineItems.map((item, index) => (
              <div
                key={item.id || index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getItemIcon(item.item_type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{item.item_name}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getItemTypeColor(item.item_type)}`}>
                        {item.item_type}
                      </span>
                    </div>
                    {item.item_description && (
                      <p className="text-sm text-gray-600 mt-1">{item.item_description}</p>
                    )}
                    <div className="text-sm text-gray-500 mt-1">
                      {item.quantity} × ₹{item.unit_price.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-medium text-gray-900">₹{item.total_price.toFixed(2)}</span>
                  {editable && onRemoveItem && (
                    <button
                      onClick={() => onRemoveItem(item.id!)}
                      className="ml-2 text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Add Item Form */}
            {editable && showAddForm && (
              <div className="p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                <h4 className="font-medium text-gray-900 mb-3">Add Line Item</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={newItem.item_type}
                      onChange={(e) => setNewItem(prev => ({ ...prev, item_type: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="consultation">Consultation</option>
                      <option value="procedure">Procedure</option>
                      <option value="medicine">Medicine</option>
                      <option value="test">Test</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item Name
                    </label>
                    <input
                      type="text"
                      value={newItem.item_name}
                      onChange={(e) => setNewItem(prev => ({ ...prev, item_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter item name"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={newItem.item_description}
                      onChange={(e) => setNewItem(prev => ({ ...prev, item_description: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit Price (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItem.unit_price}
                      onChange={(e) => setNewItem(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-gray-600">
                    Total: ₹{(newItem.quantity * newItem.unit_price).toFixed(2)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddItem}
                      disabled={!newItem.item_name || newItem.unit_price <= 0}
                    >
                      Add Item
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Item Button */}
            {editable && !showAddForm && onAddItem && (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full p-3 border border-dashed border-gray-300 rounded-lg text-gray-600 hover:text-gray-800 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Line Item
              </button>
            )}
          </div>

          {/* Summary */}
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-900">₹{subtotal.toFixed(2)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span className="text-gray-900">₹{tax.toFixed(2)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount:</span>
                  <span className="text-green-600">-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2">
                <span className="text-gray-900">Total:</span>
                <span className="text-gray-900">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
